const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const Bus = require('../models/Bus');
const Stop = require('../models/Stop');
const { calculateFareBetweenStops } = require('../utils/fareCalculator');

// Helper: Get occupied seats for a bus
const getOccupiedSeats = async (busId) => {
  const bookings = await Booking.find({ bus: busId, status: { $in: ['booked', 'in-progress'] } });
  const occupied = new Set();
  bookings.forEach((b) => b.passengers.forEach((p) => occupied.add(p.seatNumber)));
  return occupied;
};

// Helper: Auto-assign seats sequentially
const assignSeats = (count, occupied, capacity) => {
  const assigned = [];
  let seat = 1;
  while (assigned.length < count) {
    if (seat > capacity) throw new Error('Not enough seats available.');
    if (!occupied.has(seat)) assigned.push(seat);
    seat++;
  }
  return assigned;
};

// POST /api/bookings
const createBooking = async (req, res) => {
  try {
    const { busId, passengers, boardingStop, destinationStop } = req.body;

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one passenger required.' });
    }

    const bus = await Bus.findById(busId);
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found.' });
    if (bus.status === 'inactive' || bus.status === 'maintenance') {
      return res.status(400).json({ success: false, message: 'Bus is not available for booking.' });
    }

    // Get source and destination stops for fare calculation
    const sourceStopDoc = await Stop.findById(boardingStop);
    const destinationStopDoc = await Stop.findById(destinationStop);
    
    if (!sourceStopDoc || !destinationStopDoc) {
      return res.status(400).json({ success: false, message: 'Invalid source or destination stop.' });
    }

    // Calculate fare
    const fareResult = calculateFareBetweenStops(sourceStopDoc, destinationStopDoc);
    console.log("🔍 DEBUG: Fare calculation result:", fareResult);

    const occupied = await getOccupiedSeats(busId);

    // Validate that provided seat numbers are available
    const providedSeats = passengers.map(p => parseInt(p.seatNumber));
    console.log("🔍 DEBUG: Provided seats:", providedSeats);
    console.log("🔍 DEBUG: Occupied seats:", Array.from(occupied));
    
    // Check if any provided seats are already occupied
    const conflictingSeats = providedSeats.filter(seat => occupied.has(seat));
    if (conflictingSeats.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Seats ${conflictingSeats.join(', ')} are already occupied.` 
      });
    }
    
    // Check if all provided seats are valid (within bus capacity)
    const invalidSeats = providedSeats.filter(seat => seat < 1 || seat > bus.capacity);
    if (invalidSeats.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Seats ${invalidSeats.join(', ')} are invalid for this bus (capacity: ${bus.capacity}).` 
      });
    }

    if (occupied.size + passengers.length > bus.capacity) {
      return res.status(400).json({ success: false, message: 'Not enough seats available on this bus.' });
    }

    // Build passenger details with QR/RFID using provided seat numbers
    const passengerDetails = await Promise.all(
      passengers.map(async (p, index) => {
        const isChild = p.age < 18;
        const detail = {
          name: p.name,
          age: p.age,
          type: isChild ? 'child' : 'adult',
          seatNumber: parseInt(p.seatNumber), // Use provided seat number
          checkedIn: false
        };
        
        console.log("🔍 DEBUG: Creating passenger detail:", detail);

        if (isChild) {
          // Child MUST have RFID UID provided by parent/guardian
          if (!p.rfidUid) {
            throw new Error(`Passenger '${p.name}' (child) requires an RFID UID.`);
          }
          // Ensure RFID UID is not already in use
          const rfidExists = await Booking.findOne({
            bus: busId,
            status: { $in: ['booked', 'in-progress'] },
            'passengers.rfidUid': p.rfidUid
          });
          if (rfidExists) {
            throw new Error(`RFID UID '${p.rfidUid}' is already registered on this bus.`);
          }
          detail.rfidUid = p.rfidUid;
        } else {
          // Adult: auto-generate QR code (UUID)
          detail.qrCode = uuidv4();
        }

        return detail;
      })
    );

    const booking = await Booking.create({
      bookedBy: req.user._id,
      bus: busId,
      passengers: passengerDetails,
      boardingStop,
      destinationStop,
      totalSeats: passengers.length,
      fare: fareResult.fare,
      status: 'booked'
    });

    // Generate QR images for response
    const passengersWithQR = await Promise.all(
      booking.passengers.map(async (p) => {
        const obj = p.toObject();
        if (p.qrCode) {
          obj.qrCodeImage = await QRCode.toDataURL(p.qrCode);
        }
        return obj;
      })
    );

    res.status(201).json({
      success: true,
      booking: { ...booking.toObject(), passengers: passengersWithQR }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/bookings/my
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ bookedBy: req.user._id })
      .populate('bus', 'busNumber status')
      .populate('boardingStop', 'name')
      .populate('destinationStop', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bookings/:id
const getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bus', 'busNumber status route')
      .populate('boardingStop', 'name')
      .populate('destinationStop', 'name')
      .populate('bookedBy', 'name email');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // Only owner or admin can view full booking
    if (req.user.role !== 'admin' && booking.bookedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking.' });
    }

    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bookings/bus/:busId  [Conductor/Driver/Admin]
const getBusBookings = async (req, res) => {
  try {
    console.log("🔍 DEBUG: Fetching bookings for bus:", req.params.busId);
    
    const bookings = await Booking.find({
      bus: req.params.busId,
      status: { $in: ['booked', 'in-progress'] }
    }).populate('bus', 'busNumber').populate('bookedBy', 'name email');

    console.log("🔍 DEBUG: Found bookings:", bookings.length);
    
    bookings.forEach((booking, index) => {
      console.log(`🔍 DEBUG: Booking ${index + 1}:`, {
        id: booking._id,
        status: booking.status,
        busNumber: booking.bus?.busNumber,
        bookedBy: booking.bookedBy?.name,
        passengerCount: booking.passengers?.length || 0
      });
      
      booking.passengers?.forEach((passenger, pIndex) => {
        console.log(`🔍 DEBUG:   Passenger ${pIndex + 1}:`, {
          name: passenger.name,
          seatNumber: passenger.seatNumber,
          checkedIn: passenger.checkedIn,
          type: passenger.type
        });
      });
    });

    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    console.error("🔍 DEBUG: Error in getBusBookings:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/bookings/bus/:busId/seats  [Public - No Auth Required]
const getSeatAvailability = async (req, res) => {
  try {
    console.log("🔍 DEBUG: PUBLIC - Fetching seat availability for bus:", req.params.busId);
    
    const bookings = await Booking.find({
      bus: req.params.busId,
      status: { $in: ['booked', 'in-progress'] }
    }).select('passengers status');

    console.log("🔍 DEBUG: PUBLIC - Found bookings:", bookings.length);
    
    // Extract occupied seats
    const occupiedSeats = [];
    bookings.forEach((booking, index) => {
      console.log(`🔍 DEBUG: PUBLIC - Booking ${index + 1}:`, {
        id: booking._id,
        status: booking.status,
        passengerCount: booking.passengers?.length || 0
      });
      
      booking.passengers?.forEach((passenger, pIndex) => {
        console.log(`🔍 DEBUG: PUBLIC -   Passenger ${pIndex + 1}:`, {
          name: passenger.name,
          seatNumber: passenger.seatNumber,
          checkedIn: passenger.checkedIn,
          type: passenger.type
        });
        
        // Seat is occupied if booking is 'booked' OR passenger is checked in
        if (passenger.seatNumber && (booking.status === 'booked' || passenger.checkedIn)) {
          occupiedSeats.push(parseInt(passenger.seatNumber));
          console.log(`🔍 DEBUG: PUBLIC - ✅ OCCUPIED seat ${passenger.seatNumber} for passenger "${passenger.name}"`);
        }
      });
    });

    console.log("🔍 DEBUG: PUBLIC - Final occupied seats:", occupiedSeats);

    res.json({ 
      success: true, 
      occupiedSeats,
      totalBookings: bookings.length,
      busId: req.params.busId
    });
  } catch (err) {
    console.error("🔍 DEBUG: PUBLIC - Error in getSeatAvailability:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/bookings/:id/cancel
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // Only the booking owner can cancel
    if (booking.bookedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the booking owner can cancel.' });
    }

    if (['cancelled', 'completed'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: `Booking is already ${booking.status}.` });
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();

    res.json({ success: true, message: 'Booking cancelled successfully.', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// All bookings [Admin only]
const getAllBookings = async (req, res) => {
  try {
    const { status, busId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (busId) filter.bus = busId;

    const bookings = await Booking.find(filter)
      .populate('bus', 'busNumber')
      .populate('bookedBy', 'name email')
      .sort({ createdAt: -1 });
 
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createBooking, getMyBookings, getBooking, getBusBookings, cancelBooking, getAllBookings, getSeatAvailability };