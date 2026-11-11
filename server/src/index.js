import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { pool, query } from './db.js';
import { seedAdmin } from './services/seed.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundApi } from './middleware/errors.js';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import settingsRoutes from './routes/settings.js';
import activityRoutes from './routes/activity.js';
import supervisorRoutes from './routes/supervisors.js';
import studentRoutes from './routes/students.js';
import appointmentRoutes from './routes/appointments.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

const app = express();
app.set('trust proxy', 1); // Render يعمل خلف proxy
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
  })
);
app.use(compression());
if (config.clientOrigin) app.use(cors({ origin: config.clientOrigin.split(','), credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// ---------------------------------------------------------------- API
app.get('/api/health', async (req, res) => {
  try {
    await query('select 1');
    res.json({ status: 'ok', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', authenticate);
app.use('/api/profile', profileRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/supervisors', supervisorRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', notFoundApi);

// ---------------------------------------------------------------- الواجهة (React) في الإنتاج
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

async function start() {
  await seedAdmin();
  const server = app.listen(config.port, () => {
    console.log(`🚀 ملتقى المسك القرآني يعمل على المنفذ ${config.port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} — إيقاف الخادم…`);
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('❌ فشل تشغيل الخادم:', err.message);
  process.exit(1);
});
