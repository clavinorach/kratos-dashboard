export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:secret@localhost:5432/app',
  
  // Kratos URLs
  kratosPublicUrl: process.env.KRATOS_PUBLIC_URL || 'http://localhost:4433',
  kratosAdminUrl: process.env.KRATOS_ADMIN_URL || 'http://localhost:4434',
  kratosBrowserUrl: process.env.KRATOS_BROWSER_URL || 'http://127.0.0.1:4433',
  
  // App URLs
  appUrl: process.env.APP_URL || 'http://127.0.0.1:3000',
  
  // Session
  sessionSecret: process.env.SESSION_SECRET || 'change-this-super-secret-session-key',
  
  // Kratos Self-Service UI
  kratosUiUrl: process.env.KRATOS_UI_URL || 'http://127.0.0.1:4455',
};

