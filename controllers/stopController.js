const Stop = require('../models/Stop');

// GET /api/stops
const getAllStops = async (req, res) => {
  try {
    const stops = await Stop.find().sort({ name: 1 });
    res.json({ success: true, count: stops.length, stops });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/stops/:id
const getStop = async (req, res) => {
  try {
    const stop = await Stop.findById(req.params.id);
    if (!stop) return res.status(404).json({ success: false, message: 'Stop not found.' });
    res.json({ success: true, stop });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/stops  [Admin only]
const createStop = async (req, res) => {
  try {
    const { name, latitude, longitude, address } = req.body;
    const stop = await Stop.create({ name, latitude, longitude, address });
    res.status(201).json({ success: true, stop });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Stop with this name already exists.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/stops/:id  [Admin only]
const updateStop = async (req, res) => {
  try {
    const stop = await Stop.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!stop) return res.status(404).json({ success: false, message: 'Stop not found.' });
    res.json({ success: true, stop });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/stops/:id  [Admin only]
const deleteStop = async (req, res) => {
  try {
    const stop = await Stop.findByIdAndDelete(req.params.id);
    if (!stop) return res.status(404).json({ success: false, message: 'Stop not found.' });
    res.json({ success: true, message: 'Stop deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const searchStops = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || name.trim().length < 1) {
      return res.status(400).json({ success: false, message: "Query required" });
    }
    const stops = await Stop.find({
      name: { $regex: name.trim(), $options: "i" }
    }).limit(10);

    res.json({ success: true, count: stops.length, stops });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllStops, getStop, createStop, updateStop, deleteStop, searchStops };