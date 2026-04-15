const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const passengerDetailSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    required: true,
    min: 1
  },
  type: {
    type: String,
    enum: ['adult', 'child'],
    required: true
  },
  seatNumber: {
    type: Number,
    required: true
  },
  
  qrCode: {
    type: String,
    default: null
  },
  rfidUid: {
    type: String,
    default: null
  },
  checkedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: {
    type: Date,
    default: null
  }
}, { _id: true });

const bookingSchema = new mongoose.Schema({
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true
  },
  passengers: {
    type: [passengerDetailSchema],
    validate: {
      validator: (arr) => arr.length >= 1,
      message: 'At least one passenger is required'
    }
  },
  boardingStop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stop',
    required: true
  },
  destinationStop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stop',
    required: true
  },
  status: {
    type: String,
    enum: ['booked', 'in-progress', 'completed', 'cancelled'],
    default: 'booked'
  },
  totalSeats: {
    type: Number,
    required: true
  },
  fare: {
    type: Number,
    default: 0
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  ticketId: {
    type: String,
    unique: true,
    sparse: true,
    default: () => `TKT-${uuidv4().substring(0, 8).toUpperCase()}`
  }
}, { timestamps: true });


bookingSchema.index({ bus: 1, status: 1 });
bookingSchema.index({ bookedBy: 1 });
bookingSchema.index({ 'passengers.qrCode': 1 });
bookingSchema.index({ 'passengers.rfidUid': 1 });

module.exports = mongoose.model('Booking', bookingSchema);