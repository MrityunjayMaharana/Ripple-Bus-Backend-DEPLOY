const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: Number,
  longitude: Number,
  speed: { type: Number, default: 0 },
  heading: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const busSchema = new mongoose.Schema({
  busNumber: {
    type: String,
    required: [true, 'Bus number is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: 1,
    max: 100
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  conductor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  route: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stop'
  }],
  currentLocation: {
    type: locationSchema,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'en-route'],
    default: 'inactive'
  },
  plateNumber: {
    type: String,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Bus', busSchema);