import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import songRoutes from './routes/songs.js';
import categoryRoutes from './routes/categories.js';

dotenv.config();

const app = express();

// Enable CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  credentials: false
}));

app.use(express.json());

// Serve static assets from public directory if requested
app.use(express.static('public'));

// Lazy MongoDB connection middleware for serverless/local requests
app.use(async (req, res, next) => {
  if (process.env.MONGODB_URI && mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      console.warn('[DB CONN MIDDLEWARE WARN]', err.message);
    }
  }
  next();
});

// Diagnostic Health Check Endpoint (GET /api/health)
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const isYoutubeKeyConfigured = Boolean(process.env.YOUTUBE_API_KEY);

  res.status(200).json({
    status: "ok",
    database: isDbConnected,
    youtube: isYoutubeKeyConfigured,
    environment: process.env.NODE_ENV || "development"
  });
});

// Mount Routes under /api
app.use('/api/songs', songRoutes);
app.use('/api/categories', categoryRoutes);

// Catch-all route handler for unknown API paths
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Requested API route does not exist."
  });
});

// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error("[EXPRESS ERROR]", {
    method: req.method,
    url: req.originalUrl,
    message: err.message
  });

  if (res.headersSent) {
    return next(err);
  }

  const isDev = (process.env.NODE_ENV || 'development') === 'development';

  res.status(err.status || 500).json({
    error: err.code || "INTERNAL_SERVER_ERROR",
    message: err.message || "Music service encountered an internal error.",
    ...(isDev && { stack: err.stack })
  });
});

export default app;
