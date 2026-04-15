const Booking = require('../models/Booking');

// POST /api/checkin/qr  [Conductor]
// Body: { qrCode }
const checkInByQR = async (req, res) => {
  try {
    const { qrCode } = req.body;
    if (!qrCode) return res.status(400).json({ success: false, message: 'QR code is required.' });

    const booking = await Booking.findOne({
      'passengers.qrCode': qrCode,
      status: { $in: ['booked', 'in-progress'] }
    }).populate('bus', 'busNumber');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'No valid booking found for this QR code.' });
    }

    const passenger = booking.passengers.find((p) => p.qrCode === qrCode);

    if (passenger.checkedIn) {
      return res.status(400).json({ success: false, message: 'Passenger already checked in.' });
    }

    // Mark checked in
    passenger.checkedIn = true;
    passenger.checkedInAt = new Date();

    // Update booking status to in-progress
    if (booking.status === 'booked') booking.status = 'in-progress';

    await booking.save();

    res.json({
      success: true,
      message: `${passenger.name} (Seat ${passenger.seatNumber}) checked in successfully.`,
      passenger,
      bus: booking.bus
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/checkin/rfid  [Conductor / ESP32 via secured endpoint]
// Body: { rfidUid, busId }
const checkInByRFID = async (req, res) => {
  try {
    const { rfidUid, busId } = req.body;
    if (!rfidUid) return res.status(400).json({ success: false, message: 'RFID UID is required.' });

    const query = { 'passengers.rfidUid': rfidUid, status: { $in: ['booked', 'in-progress'] } };
    if (busId) query.bus = busId;

    const booking = await Booking.findOne(query).populate('bus', 'busNumber');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'No valid booking found for this RFID UID.' });
    }

    const passenger = booking.passengers.find((p) => p.rfidUid === rfidUid);

    if (passenger.checkedIn) {
      return res.status(400).json({ success: false, message: 'Child already checked in.' });
    }

    passenger.checkedIn = true;
    passenger.checkedInAt = new Date();

    if (booking.status === 'booked') booking.status = 'in-progress';

    await booking.save();

    res.json({
      success: true,
      message: `Child ${passenger.name} (Seat ${passenger.seatNumber}) checked in via RFID.`,
      passenger,
      bus: booking.bus
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/checkin/bus/:busId/passengers  [Conductor/Driver/Admin]
const getBusPassengers = async (req, res) => {
  try {
    const bookings = await Booking.find({
      bus: req.params.busId,
      status: { $in: ['booked', 'in-progress'] }
    });

    const passengers = [];
    bookings.forEach((b) => {
      b.passengers.forEach((p) => {
        passengers.push({
          ...p.toObject(),
          bookingId: b._id
        });
      });
    });

    const checkedInCount = passengers.filter((p) => p.checkedIn).length;

    res.json({
      success: true,
      total: passengers.length,
      checkedIn: checkedInCount,
      passengers
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { checkInByQR, checkInByRFID, getBusPassengers };