require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { connectMongo, connectRedis } = require('./config/db');
const { socketAuth } = require('./middleware/auth');
const { initSocket, cleanupSocket } = require('./socket/socketHandler');
const routes = require('./routes/index');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', routes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// Socket.io Setup
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Apply JWT auth middleware to all socket connections
io.use(socketAuth);

// Initialize socket handlers
initSocket(io);

// Start Server
const PORT = process.env.PORT || 7000;

const startServer = async () => {
  try {
    await connectMongo();
    await connectRedis();

    server.listen(PORT, () => {
      console.log(`\nSmart Bus System running on port ${PORT}`);
      console.log(`REST API: http://localhost:${PORT}/api`);
      console.log(`WebSocket: ws://localhost:${PORT}\n`);
    });
  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  cleanupSocket();
  server.close(() => process.exit(0));
});