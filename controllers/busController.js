const Bus = require('../models/Bus');
const { getRedis } = require('../config/db');
const mongoose = require('mongoose');

// GET /api/buses
const getAllBuses = async (req, res) => {
  try {
    const buses = await Bus.find()
      .populate('driver', 'name email phone')
      .populate('conductor', 'name email phone')
      .populate('route', 'name latitude longitude');
    res.json({ success: true, count: buses.length, buses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/buses/:id
const getBus = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .populate('driver', 'name email phone')
      .populate('conductor', 'name email phone')
      .populate('route', 'name latitude longitude');
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found.' });
    res.json({ success: true, bus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/buses/:id/live-location
const getLiveLocation = async (req, res) => {
  try {
    const redis = getRedis();
    const cached = await redis.get(`bus:${req.params.id}:location`);

    if (cached) {
      return res.json({ success: true, source: 'redis', location: JSON.parse(cached) });
    }

    // Fallback to MongoDB
    const bus = await Bus.findById(req.params.id).select('currentLocation busNumber');
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found.' });

    res.json({ success: true, source: 'mongodb', location: bus.currentLocation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/buses/active
const getActiveBuses = async (req, res) => {
  try {
    // For public tracking, return buses that are active or en-route
    const buses = await Bus.find({ 
      status: { $in: ['active', 'en-route'] }
    })
      .populate('driver', 'name email phone')
      .populate('conductor', 'name email phone')
      .populate('route', 'name latitude longitude');
    
    res.json({ success: true, count: buses.length, buses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/buses  [Admin only]
const createBus = async (req, res) => {
  try {
    const { busNumber, capacity, driver, conductor, route, plateNumber } = req.body;
    const bus = await Bus.create({ busNumber, capacity, driver, conductor, route, plateNumber });
    res.status(201).json({ success: true, bus });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Bus number already exists.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/buses/:id  [Admin only]
const updateBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found.' });
    res.json({ success: true, bus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/buses/:id  [Admin only]
const deleteBus = async (req, res) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found.' });
    res.json({ success: true, message: 'Bus deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/buses/search?source=<stopId>&destination=<stopId>
const searchBusesByStops = async (req, res) => {
  try {
    const { source, destination } = req.query;

    if (!source || !destination) {
      return res.status(400).json({
        success: false,
        message: "Source and destination stop IDs are required"
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(source) ||
      !mongoose.Types.ObjectId.isValid(destination)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid stop IDs"
      });
    }

    // Find all buses that have BOTH stops in their route
    const buses = await Bus.find({
      route: {
        $all: [
          new mongoose.Types.ObjectId(source),
          new mongoose.Types.ObjectId(destination)
        ]
      }
    })
      .populate('route', 'name latitude longitude')
      .populate('driver', 'name phone')
      .populate('conductor', 'name phone');

    // Filter: source must appear BEFORE destination in route order
    const validBuses = buses.filter(bus => {
      const sourceIndex = bus.route.findIndex(
        stop => stop._id.toString() === source
      );
      const destIndex = bus.route.findIndex(
        stop => stop._id.toString() === destination
      );
      return sourceIndex !== -1 && destIndex !== -1 && sourceIndex < destIndex;
    });

    // Only return active or en-route buses
    const activeBuses = validBuses.filter(bus =>
      ['active', 'en-route'].includes(bus.status)
    );

    return res.status(200).json({
      success: true,
      count: activeBuses.length,
      buses: activeBuses
    });

  } catch (err) {
    console.error('searchBusesByStops error:', err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

module.exports = { getAllBuses, getBus, getLiveLocation, getActiveBuses, createBus, updateBus, deleteBus, searchBusesByStops };