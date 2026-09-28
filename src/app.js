const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const dokterRoutes = require('./routes/dokter.routes');
const { errorHandler } = require('./middlewares/error.middleware');

const app = express();

const path = require('path');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Custom Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode >= 400 ? '❌ GAGAL' : '✅ BERHASIL';
    console.log(`[${new Date().toLocaleTimeString()}] ${status} | ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | ${duration}ms`);
  });
  next();
});

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const monitoringRoutes = require('./routes/monitoring.routes');
const masterAlergiRoutes = require('./routes/masterAlergi.routes');

// API Routes
app.use('/api', routes);
app.use('/api/dokter', dokterRoutes);
app.use('/api/satusehat-monitoring', monitoringRoutes);
app.use('/api/master-alergi', masterAlergiRoutes);

// Base route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Kesehatan API' });
});

// Handle 404
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
