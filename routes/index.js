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
router.get('/buses/active', protect, getActiveBuses);
router.get('/buses/search', protect, searchBusesByStops);
router.get('/buses/:id', protect, getBus);
router.get('/buses/:id/live-location', protect, getLiveLocation);
router.post('/buses', protect, authorize('admin'), createBus);
router.put('/buses/:id', protect, authorize('admin'), updateBus);
router.delete('/buses/:id', protect, authorize('admin'), deleteBus);

// Bookings
const { createBooking, getMyBookings, getBooking, getBusBookings, cancelBooking, getAllBookings } = require('../controllers/bookingController');
router.get('/bookings/my', protect, authorize('passenger'), getMyBookings);
router.get('/bookings/bus/:busId', protect, authorize('conductor', 'driver', 'admin'), getBusBookings);
router.get('/bookings/all', protect, authorize('admin'), getAllBookings);
router.get('/bookings/:id', protect, getBooking);
router.post('/bookings', protect, authorize('passenger'), createBooking);
router.put('/bookings/:id/cancel', protect, authorize('passenger'), cancelBooking);

// Check-in
const { checkInByQR, checkInByRFID, getBusPassengers } = require('../controllers/checkinController');
router.post('/checkin/qr', protect, authorize('conductor'), checkInByQR);
router.post('/checkin/rfid', protect, authorize('conductor'), checkInByRFID);
router.get('/checkin/bus/:busId/passengers', protect, authorize('conductor', 'driver', 'admin'), getBusPassengers);

// Emergency
const { getAllAlerts, resolveAlert, createAlert } = require('../controllers/emergencyController');
router.get('/emergency', protect, authorize('admin'), getAllAlerts);
router.post('/emergency', protect, authorize('passenger', 'driver', 'conductor'), createAlert);
router.put('/emergency/:id/resolve', protect, authorize('admin'), resolveAlert);

module.exports = router;