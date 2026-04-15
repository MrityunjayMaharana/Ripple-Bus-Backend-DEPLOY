// controllers/emergencyController.js

const EmergencyAlert = require('../models/EmergencyAlert');

// GET /api/emergency  [Admin only]
const getAllAlerts = async (req, res) => {
  try {
    const alerts = await EmergencyAlert.find()
      .populate('bus', 'busNumber')
      .populate('triggeredBy', 'name role')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: alerts.length, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/emergency  [Passenger, Driver, Conductor]
const createAlert = async (req, res) => {
  try {
    const { busId, message, location } = req.body;
    const userId = req.user._id;

    // Validation
    if (!busId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bus ID is required.' 
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Emergency message is required.' 
      });
    }

    // Optional: Check if bus exists
    const Bus = require('../models/Bus');
    const busExists = await Bus.findById(busId);
    if (!busExists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bus not found.' 
      });
    }

    // Create new alert
    const alert = await EmergencyAlert.create({
      bus: busId,
      triggeredBy: userId,
      message: message.trim(),
      location: location ? {
        latitude: location.latitude,
        longitude: location.longitude
      } : undefined,
      isResolved: false,
      resolvedAt: null
    });

    // Add this to the createAlert function after creating the alert

// Emit socket event for real-time alerts
const io = req.app.get('io');
if (io) {
  // Emit to all clients in the bus room
  io.to(`bus_${busId}`).emit('emergencyAlert', {
    busId,
    alertId: alert._id,
    message: message.trim(),
    triggeredBy: {
      name: req.user.name,
      role: req.user.role
    },
    timestamp: new Date()
  });
  
  // Emit to admin room for dashboard notifications
  io.to('admin_room').emit('adminEmergencyAlert', {
    busId,
    alertId: alert._id,
    message: message.trim(),
    triggeredBy: {
      name: req.user.name,
      role: req.user.role
    },
    timestamp: new Date()
  });
}

    // Populate the created alert with bus and user details
    const populatedAlert = await EmergencyAlert.findById(alert._id)
      .populate('bus', 'busNumber')
      .populate('triggeredBy', 'name role');

    res.status(201).json({ 
      success: true, 
      message: 'Emergency alert sent successfully.',
      alert: populatedAlert 
    });

  } catch (err) {
    console.error('Error creating emergency alert:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to create emergency alert.' 
    });
  }
};

// PUT /api/emergency/:id/resolve  [Admin only]
const resolveAlert = async (req, res) => {
  try {
    const alert = await EmergencyAlert.findByIdAndUpdate(
      req.params.id,
      { isResolved: true, resolvedAt: new Date() },
      { new: true }
    ).populate('bus', 'busNumber')
     .populate('triggeredBy', 'name role');
    
    if (!alert) {
      return res.status(404).json({ 
        success: false, 
        message: 'Alert not found.' 
      });
    }
    
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

module.exports = { getAllAlerts, createAlert, resolveAlert };