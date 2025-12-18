import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import { pool } from './db/client';

// Routes
import meRoutes from './routes/me';
import adminRoutes from './routes/admin';
import appRoutes from './routes/app';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Home page - redirect to app
app.get('/', (req, res) => {
  res.redirect('/app');
});

// API Routes
app.use('/me', meRoutes);
app.use('/admin', adminRoutes);

// App Routes (HTML)
app.use('/app', appRoutes);

// Logout route
app.get('/logout', async (req, res) => {
  try {
    // Call Kratos to create a logout flow
    const response = await fetch(`${config.kratosPublicUrl}/self-service/logout/browser`, {
      headers: {
        'Cookie': req.headers.cookie || ''
      }
    });
    
    const logoutFlow = await response.json();
    
    // Redirect to the logout URL with token
    res.redirect(logoutFlow.logout_url);
  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('/app');
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('Database connection established');

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Kratos Public URL: ${config.kratosPublicUrl}`);
      console.log(`App URL: ${config.appUrl}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

