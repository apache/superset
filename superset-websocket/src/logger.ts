import winston from 'winston';

interface LoggingOptionsType {
  silent: boolean;
  logLevel: string;
  logToFile: boolean;
  logFilename: string;
}

export function createLogger(opts: LoggingOptionsType) {
  const logTransports: Array<winston.transport> = [
    new winston.transports.Console({ handleExceptions: true }),
  ];

  if (opts.logToFile && opts.logFilename) {
    logTransports.push(
      new winston.transports.File({
        filename: opts.logFilename,
        handleExceptions: true,
      }),
    );
  }

  return winston.createLogger({
    level: opts.logLevel,
    transports: logTransports,
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    silent: opts.silent,
  });
}
