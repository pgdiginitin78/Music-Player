import mongoose from 'mongoose';

/**
 * Global Mongoose Connection Caching Pattern for Vercel Serverless Functions
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    if (process.env.NODE_ENV === 'development') {
      // Allow local MongoDB fallback in development mode only
      const localUri = 'mongodb://localhost:27017/music_app';
      if (mongoose.connection.readyState !== 1) {
        try {
          const conn = await mongoose.connect(localUri, { bufferCommands: false, serverSelectionTimeoutMS: 2000 });
          console.log(`[DB SUCCESS] Connected to local MongoDB: ${conn.connection.host}`);
          return conn;
        } catch (err) {
          console.warn(`[DB NOTICE] Local MongoDB unavailable (${err.message}). Live YouTube Data API provider active.`);
          return null;
        }
      }
      return mongoose.connection;
    }

    console.warn('[DB NOTICE] MONGODB_URI environment variable not configured. Live YouTube Data API provider active.');
    return null;
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000
    };

    cached.promise = mongoose.connect(mongoUri, opts).then((mongooseInstance) => {
      console.log(`[DB SUCCESS] MongoDB Atlas Connected: ${mongooseInstance.connection.host}`);
      return mongooseInstance;
    }).catch((err) => {
      cached.promise = null;
      console.warn(`[DB WARN] MongoDB Atlas Connection Failure: ${err.message}. Live YouTube Data API provider active.`);
      return null;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    return null;
  }

  return cached.conn;
};

export default connectDB;
