import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import { getNetworkInfo } from './network.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Bondtex Production Tracking Dashboard API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend in production or fallback
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Fallback for SPA routing in Express 5
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // In development or if dist not built yet
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Bondtex Production Server</title></head>
          <body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:40px;text-align:center;">
            <h2>Bondtex Production API Server is Running on port ${PORT}</h2>
            <p>Vite Frontend is running on <a style="color:#38bdf8;" href="http://localhost:3000">http://localhost:3000</a></p>
            <p>API Endpoint: <a style="color:#38bdf8;" href="/api/categories">/api/categories</a></p>
          </body>
        </html>
      `);
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const net = getNetworkInfo();
  console.log(`====================================================`);
  console.log(`🚀 Bondtex Production Tracking Backend API is LIVE!`);
  console.log(`📡 Localhost:     http://localhost:${PORT}`);
  console.log(`📱 Wi-Fi Network: http://${net.primaryIp}:${PORT}`);
  console.log(`📊 API Base:      http://${net.primaryIp}:${PORT}/api`);
  console.log(`📁 Network Info:  http://${net.primaryIp}:${PORT}/api/network-info`);
  console.log(`====================================================`);
});
