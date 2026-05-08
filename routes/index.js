const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// Auth
const { signup, login, getMe } = require('../controllers/authController');
router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.get('/auth/me', protect, getMe);

const { getAllUsers } = require("../controllers/userController");

// Add this route (anywhere, auth protected)
router.get("/users", protect, authorize("admin"), getAllUsers);

// Stops
const { getAllStops, getStop, createStop, updateStop, deleteStop, searchStops } = require('../controllers/stopController');
router.get('/stops', getAllStops);
router.get("/stops/search", searchStops); 
router.get('/stops/:id', getStop);
router.post('/stops', protect, authorize('admin'), createStop);
router.put('/stops/:id', protect, authorize('admin'), updateStop);
router.delete('/stops/:id', protect, authorize('admin'), deleteStop);

// Buses
const { getAllBuses, getBus, getLiveLocation, getActiveBuses, createBus, updateBus, deleteBus, searchBusesByStops } = require('../controllers/busController');
router.get('/buses', protect, getAllBuses);
router.get('/buses/active', getActiveBuses); // Public access for tracking
router.get('/buses/search', protect, searchBusesByStops);
router.get('/buses/:id', getBus); // Public access for bus tracking
router.get('/buses/:id/live-location', getLiveLocation); // Public access for live tracking
router.post('/buses', protect, authorize('admin'), createBus);
router.put('/buses/:id', protect, authorize('admin'), updateBus);
router.delete('/buses/:id', protect, authorize('admin'), deleteBus);

// Bookings
const { createBooking, getMyBookings, getBooking, getBusBookings, cancelBooking, getAllBookings, getSeatAvailability } = require('../controllers/bookingController');
router.get('/bookings/my', protect, authorize('passenger'), getMyBookings);
router.get('/bookings/bus/:busId', protect, authorize('conductor', 'driver', 'admin'), getBusBookings);
router.get('/bookings/all', protect, authorize('admin'), getAllBookings);
router.get('/bookings/:id', protect, getBooking);
router.post('/bookings', protect, authorize('passenger'), createBooking);
router.put('/bookings/:id/cancel', protect, authorize('passenger'), cancelBooking);

// Public endpoint for seat availability (no auth required)
router.get('/bookings/bus/:busId/seats', getSeatAvailability);

// Debug endpoint to check stop coordinates (no auth required)
const Stop = require('../models/Stop');
router.get('/debug/stops', async (req, res) => {
  try {
    const stops = await Stop.find({}).select('name coordinates latitude longitude');
    console.log("🔍 DEBUG: All stops data:", stops);
    res.json({ success: true, stops });
  } catch (error) {
    console.error("🔍 DEBUG: Error fetching stops:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check-in
const { checkInByQR, checkInByRFID, checkOutByQR, checkOutByRFID, getBusPassengers, checkOutPassenger } = require('../controllers/checkinController');
router.post('/checkin/qr', protect, authorize('conductor'), checkInByQR);
router.post('/checkin/rfid', protect, authorize('conductor'), checkInByRFID);
router.post('/checkin/qr/checkout', protect, authorize('conductor'), checkOutByQR);
router.post('/checkin/rfid/checkout', protect, authorize('conductor'), checkOutByRFID);
router.post('/checkin/passenger/checkout', protect, authorize('conductor'), checkOutPassenger);
router.get('/checkin/bus/:busId/passengers', getBusPassengers); // Public access for seat information

// Emergency
const { getAllAlerts, resolveAlert, createAlert } = require('../controllers/emergencyController');
router.get('/emergency', protect, authorize('admin'), getAllAlerts);
router.post('/emergency', protect, authorize('passenger', 'driver', 'conductor'), createAlert);
router.put('/emergency/:id/resolve', protect, authorize('admin'), resolveAlert);

module.exports = router;