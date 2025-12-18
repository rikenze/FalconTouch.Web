import { Queue } from 'bullmq';
import redisConnection from '../../../../../redisIoredisClient.js';

export const pixQueue = new Queue('pixQueue', { connection: redisConnection });
