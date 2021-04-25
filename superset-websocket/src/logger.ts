/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
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
