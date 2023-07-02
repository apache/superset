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
import fs from 'fs';

type ConfigType = {
  port: number;
  logLevel: string;
  logToFile: boolean;
  logFilename: string;
  statsd: {
    host: string;
    port: number;
    globalTags: Array<string>;
  };
  redis: {
    port: number;
    host: string;
    password: string;
    db: number;
    ssl: boolean;
  };
  redisStreamPrefix: string;
  redisStreamReadCount: number;
  redisStreamReadBlockMs: number;
  jwtSecret: string;
  jwtCookieName: string;
  socketResponseTimeoutMs: number;
  pingSocketsIntervalMs: number;
  gcChannelsIntervalMs: number;
};

function defaultConfig(): ConfigType {
  return {
    port: 8080,
    logLevel: 'info',
    logToFile: false,
    logFilename: 'app.log',
    redisStreamPrefix: 'async-events-',
    redisStreamReadCount: 100,
    redisStreamReadBlockMs: 5000,
    jwtSecret: '',
    jwtCookieName: 'async-token',
    socketResponseTimeoutMs: 60 * 1000,
    pingSocketsIntervalMs: 20 * 1000,
    gcChannelsIntervalMs: 120 * 1000,
    statsd: {
      host: '127.0.0.1',
      port: 8125,
      globalTags: [],
    },
    redis: {
      host: '127.0.0.1',
      port: 6379,
      password: '',
      db: 0,
      ssl: false,
    },
  };
}

function configFromFile(): Partial<ConfigType> {
  const isTest = process.env.NODE_ENV === 'test';
  const configFile = isTest ? '../config.test.json' : '../config.json';
  try {
    const configData = fs.readFileSync(configFile, 'utf8');
    const config = JSON.parse(configData);
    return config;
  } catch (err) {
    console.warn('Error loading config file:', err);
    return {};
  }
}

const isPresent = (s: string) => /\S+/.test(s);
const toNumber = (s: string) => {
  const num = Number(s);
  return Number.isNaN(num) ? 0 : num;
};
const toBoolean = (s: string) => s.toLowerCase() === 'true';
const toStringArray = (s: string) => s.split(',');

function applyEnvOverrides(config: ConfigType): ConfigType {
  const envVarConfigMapping: { [envVar: string]: keyof ConfigType } = {
    PORT: 'port',
    LOG_LEVEL: 'logLevel',
    LOG_TO_FILE: 'logToFile',
    LOG_FILENAME: 'logFilename',
    REDIS_STREAM_PREFIX: 'redisStreamPrefix',
    REDIS_STREAM_READ_COUNT: 'redisStreamReadCount',
    REDIS_STREAM_READ_BLOCK_MS: 'redisStreamReadBlockMs',
    JWT_SECRET: 'jwtSecret',
    JWT_COOKIE_NAME: 'jwtCookieName',
    SOCKET_RESPONSE_TIMEOUT_MS: 'socketResponseTimeoutMs',
    PING_SOCKETS_INTERVAL_MS: 'pingSocketsIntervalMs',
    GC_CHANNELS_INTERVAL_MS: 'gcChannelsIntervalMs',
    REDIS_HOST: 'redis.host',
    REDIS_PORT: 'redis.port',
    REDIS_PASSWORD: 'redis.password',
    REDIS_DB: 'redis.db',
    REDIS_SSL: 'redis.ssl',
    STATSD_HOST: 'statsd.host',
    STATSD_PORT: 'statsd.port',
    STATSD_GLOBAL_TAGS: 'statsd.globalTags',
  };

  Object.entries(envVarConfigMapping).forEach(([envVar, configKey]) => {
    const envValue = process.env[envVar];
    if (envValue && isPresent(envValue)) {
      const keys = configKey.split('.');
      if (keys.length === 1) {
        config[keys[0]] = envValue;
      } else if (keys.length === 2) {
        config[keys[0]][keys[1]] = envValue;
      }
    }
  });

  return config;
}

export function buildConfig(): ConfigType {
  const config = Object.assign(defaultConfig(), configFromFile());
  return applyEnvOverrides(config);
}
