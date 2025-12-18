import winston from 'winston';
import path from 'path';
import fs from 'fs';

export const logsDir = path.resolve('logs');
export const webhookLogPath = path.join(logsDir, 'webhook.log');

// Garante que a pasta 'logs' existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: webhookLogPath }),
    // new winston.transports.Console(), // opcional: exibe logs no terminal
  ],
});

