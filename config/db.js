const mongoose = require('mongoose');
const { createClient } = require('redis');

// MongoDB Connection
const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Redis Client
let redisClient = null;

const connectRedis = async () => {
  redisClient = createClient({ url: process.env.REDIS_URL });

  redisClient.on('error', (err) => console.error('Redis error:', err));
  redisClient.on('connect', () => console.log('Redis connected'));

  await redisClient.connect();
  return redisClient;
};

const getRedis = () => {
  if (!redisClient) throw new Error('Redis not initialized');
  return redisClient;
};

module.exports = { connectMongo, connectRedis, getRedis };