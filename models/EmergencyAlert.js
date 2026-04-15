const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema({
  bus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true
  },
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    latitude: Number,
    longitude: Number
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  isResolved: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('EmergencyAlert', emergencyAlertSchema);