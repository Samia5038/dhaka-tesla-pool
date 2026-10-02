const express = require('express');
const cors = require('cors');
const prisma = require('./db');

const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
const driverRoutes = require('./routes/driver');
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/driver', driverRoutes);
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'down' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);

module.exports = app;
