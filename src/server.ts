import prisma from './lib/prisma';
import app from './app';
import { config } from './config/env';

async function startServer(): Promise<void> {
  try {
    // Verify database connectivity on startup
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connected successfully.');

    const port = config.port;

    const server = app.listen(port, () => {
      console.log(`ETA Backend running on http://localhost:${port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`API base URL: http://localhost:${port}/api/v1`);
    });

    // ─── Graceful shutdown ───────────────────────────────────────────────────
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        await prisma.$disconnect();
        console.log('Database connection closed.');
        process.exit(0);
      });

      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// ─── Unhandled promise rejections ─────────────────────────────────────────────
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// ─── Uncaught exceptions ──────────────────────────────────────────────────────
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
