import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});

export type LogContext = {
  event: string;
  invocationId?: string;
  sessionId?: string;
  conversationId?: string;
  userId?: string;
};

export function logEvent(context: LogContext, data?: Record<string, unknown>) {
  logger.info({ ...context, ...data }, context.event);
}
