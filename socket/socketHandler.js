const { getRedis } = require('../config/db');
const Bus = require('../models/Bus');
const EmergencyAlert = require('../models/EmergencyAlert');
const { computeSafetyScore } = require('../utils/safetyScore');
const { checkInByRFID } = require('../controllers/checkinController');

const LOCATION_TTL       = parseInt(process.env.BUS_LOCATION_TTL)      || 300;
const SYNC_INTERVAL      = parseInt(process.env.LOCATION_SYNC_INTERVAL) || 15000;
const SPEED_HISTORY_SIZE = 10;

const speedHistories = {};
let syncInterval = null;

async function sendCachedScore(socket, busId) {
  try {
    const redis = getRedis();
    const cached = await redis.get(`bus:${busId}:location`);
    if (!cached) return;
    const loc = JSON.parse(cached);
    if (!loc.safety) return;
    socket.emit('busLocationUpdate', {
      busId,
      latitude:  loc.latitude,
      longitude: loc.longitude,
      heading:   loc.heading,
      updatedAt: loc.updatedAt,
      safety: {
        score: loc.safety.score,
        band:  loc.safety.band,
        label: loc.safety.label,
        color: loc.safety.color,
        flags: loc.safety.flags,
        cabin: loc.safety.cabin,
      }
    });
  } catch (_) {}
}

const initSocket = (io) => {

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[${user.role}] ${user.name} connected`);

    // Room management
    socket.on('joinBusRoom', ({ busId }) => {
      socket.join(`bus_${busId}`);
      sendCachedScore(socket, busId);
      console.log(`${user.name} joined bus_${busId}`);
    });

    socket.on('leaveBusRoom', ({ busId }) => {
      socket.leave(`bus_${busId}`);
    });

    if (user.role === 'admin') socket.join('adminRoom');

    // Driver: GPS telemetry
    socket.on('driverLocation', async (data) => {
      if (user.role !== 'driver') {
        return socket.emit('error', { message: 'Only drivers can emit location.' });
      }

      const {
        busId, latitude, longitude,
        speed = 0, heading = 0,
        obstacleDistance = 80, obstacleDetected = false,
        temperature = null, humidity = null, dhtValid = false,
        gpsFix = true, satellites = 6, hdop = 1.0,
        accelX = 0, accelY = 0, accelZ = 9.8,
        gyroX = 0, gyroY = 0, gyroZ = 0,
        accelMagnitude = 9.8,
        rashHarshBrake = false, rashHarshAccel = false,
        rashHarshTurn = false, rashBump = false,
      } = data;

      if (!busId || latitude == null || longitude == null) {
        return socket.emit('error', { message: 'busId, latitude, longitude required.' });
      }

      const bus = await Bus.findOne({ _id: busId, driver: user._id });
      if (!bus) return socket.emit('error', { message: 'Not assigned to this bus.' });

      // Speed history for stability scoring
      if (!speedHistories[busId]) speedHistories[busId] = [];
      speedHistories[busId].push(speed);
      if (speedHistories[busId].length > SPEED_HISTORY_SIZE) speedHistories[busId].shift();

      // Compute safety score
      const scoreResult = computeSafetyScore(
        { speed, obstacleDistance, obstacleDetected,
          temperature, humidity, dhtValid,
          gpsFix, satellites, hdop,
          accelMagnitude, rashHarshBrake, rashHarshAccel, rashHarshTurn, rashBump },
        speedHistories[busId]
      );

      const locationData = { busId, latitude, longitude, speed, heading, updatedAt: new Date().toISOString() };

      // Passenger-safe payload — no raw sensor values
      const passengerPayload = {
        busId, latitude, longitude, heading,
        updatedAt: locationData.updatedAt,
        safety: {
          score: scoreResult.score,
          band:  scoreResult.band,
          label: scoreResult.label,
          color: scoreResult.color,
          flags: scoreResult.flags,
          cabin: scoreResult.cabin,
        }
      };

      // Admin/driver full payload
      const adminPayload = {
        ...passengerPayload,
        telemetry: { speed, obstacleDistance, obstacleDetected, gpsFix, satellites, hdop, accelX, accelY, accelZ, gyroX, gyroY, gyroZ, accelMagnitude },
        safety: { ...passengerPayload.safety, subScores: scoreResult.subScores }
      };

      try {
        const redis = getRedis();
        await redis.setEx(`bus:${busId}:location`, LOCATION_TTL,
          JSON.stringify({ ...locationData, safety: scoreResult }));
        await redis.sAdd('activeBuses', busId);

        // Broadcast to passengers (safe data only)
        // console.log(passengerPayload)
        io.to(`bus_${busId}`).emit('busLocationUpdate', passengerPayload);
        // Full data to admins
        io.to('adminRoom').emit('busTelemetry', adminPayload);
        // Score feedback to driver
        socket.emit('safetyScore', {
          score:     scoreResult.score,
          band:      scoreResult.band,
          label:     scoreResult.label,
          subScores: scoreResult.subScores,
        });
      } catch (err) {
        console.error('Redis error:', err.message);
        socket.emit('error', { message: 'Failed to store location.' });
      }
    });

    // Passenger SOS
    // Triggered when a passenger presses SOS button inside the bus tracking page
    socket.on('passengerSOS', async (data) => {
      if (user.role !== 'passenger') {
        return socket.emit('error', { message: 'Only passengers can send SOS.' });
      }

      const { busId, message } = data;
      if (!busId) return socket.emit('error', { message: 'busId required.' });

      const sosPayload = {
        type:      'PASSENGER_SOS',
        busId,
        passenger: {
          id:    user._id,
          name:  user.name,
          phone: user.phone || 'N/A',
        },
        message:   message || 'Passenger needs immediate assistance!',
        timestamp: new Date().toISOString(),
      };

      // Broadcast to ALL other passengers in the same bus room
      socket.to(`bus_${busId}`).emit('passengerSOS', sosPayload);

      // Also alert admins
      io.to('adminRoom').emit('passengerSOS', sosPayload);

      // Confirm to sender
      socket.emit('sosConfirmed', {
        success: true,
        message: 'SOS sent to all passengers and admin.',
        timestamp: sosPayload.timestamp,
      });

      console.log(`🆘 SOS from ${user.name} on bus ${busId}: ${sosPayload.message}`);
    });

    socket.on("rfidCheckin", async (data) => {
      try {
        const { rfidUid, busId } = data;
        console.log(`RFID check-in attempt: UID=${rfidUid}, busId=${busId}`);
        const req = { body: { rfidUid, busId }, user: socket.user };
        const res = {
          status: (code) => ({
            json: (obj) => io.emit("rfidResponse", obj)
          }),
          json: (obj) => io.emit("rfidResponse", obj)
        };
        
        await checkInByRFID(req, res);
    
      } catch (err) {
        socket.emit("rfidResponse", { success: false, message: err.message });
      }
    });

    // Driver/Conductor emergency
    socket.on('emergencyAlert', async (data) => {
      if (!['driver', 'conductor'].includes(user.role)) {
        return socket.emit('error', { message: 'Unauthorized.' });
      }

      const { busId, message, latitude, longitude } = data;
      if (!busId || !message) return socket.emit('error', { message: 'busId and message required.' });

      try {
        const redis = getRedis();
        const cached = await redis.get(`bus:${busId}:location`);
        const loc = cached ? JSON.parse(cached) : null;

        const alert = await EmergencyAlert.create({
          bus: busId,
          triggeredBy: user._id,
          message,
          location: latitude
            ? { latitude, longitude }
            : loc ? { latitude: loc.latitude, longitude: loc.longitude }
            : undefined
        });

        const payload = {
          alertId:     alert._id,
          busId,
          triggeredBy: { name: user.name, role: user.role },
          message,
          location:    alert.location,
          timestamp:   alert.createdAt,
        };

        io.to('adminRoom').emit('emergencyAlert', payload);
        io.to(`bus_${busId}`).emit('emergencyAlert', payload);
        socket.emit('emergencyAlertSent', { success: true, alertId: alert._id });

        console.log(`Emergency from ${user.name} on bus ${busId}`);
      } catch (err) {
        socket.emit('error', { message: 'Failed to send emergency alert.' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`${user.name} disconnected`);
    });
  });

  // Redis → MongoDB sync
  syncInterval = setInterval(async () => {
    try {
      const redis = getRedis();
      const activeBusIds = await redis.sMembers('activeBuses');
      for (const busId of activeBusIds) {
        const cached = await redis.get(`bus:${busId}:location`);
        if (!cached) {
          await redis.sRem('activeBuses', busId);
          await Bus.findByIdAndUpdate(busId, { status: 'inactive' });
          delete speedHistories[busId];
          continue;
        }
        const loc = JSON.parse(cached);
        await Bus.findByIdAndUpdate(busId, {
          currentLocation: {
            latitude: loc.latitude, longitude: loc.longitude,
            speed: loc.speed, heading: loc.heading,
            updatedAt: new Date(loc.updatedAt)
          },
          status: 'en-route'
        });
      }
      if (activeBusIds.length > 0) console.log(`Synced ${activeBusIds.length} bus(es)`);
    } catch (err) {
      console.error('Sync error:', err.message);
    }
  }, SYNC_INTERVAL);

  return io;
};

const cleanupSocket = () => { if (syncInterval) clearInterval(syncInterval); };
module.exports = { initSocket, cleanupSocket };