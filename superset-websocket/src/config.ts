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
  jwtAlgorithms: string[];
  jwtSecret: string;
  jwtCookieName: string;
  jwtChannelIdKey: string;
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
    jwtAlgorithms: ['HS256'],
    jwtSecret: '',
    jwtCookieName: 'async-token',
    jwtChannelIdKey: 'channel',
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
    return require(configFile);
  } catch (err) {
    console.warn('config.json file not found');
    return {};
  }
}

const isPresent = (s: string) => /\S+/.test(s);
const toNumber = Number;
const toBoolean = (s: string) => s.toLowerCase() === 'true';
const toStringArray = (s: string) => s.split(',');

function applyEnvOverrides(config: ConfigType): ConfigType {
  const envVarConfigSetter: { [envVar: string]: (val: string) => void } = {
    PORT: val => (config.port = toNumber(val)),
    LOG_LEVEL: val => (config.logLevel = val),
    LOG_TO_FILE: val => (config.logToFile = toBoolean(val)),
    LOG_FILENAME: val => (config.logFilename = val),
    REDIS_STREAM_PREFIX: val => (config.redisStreamPrefix = val),
    REDIS_STREAM_READ_COUNT: val =>
      (config.redisStreamReadCount = toNumber(val)),
    REDIS_STREAM_READ_BLOCK_MS: val =>
      (config.redisStreamReadBlockMs = toNumber(val)),
    JWT_SECRET: val => (config.jwtSecret = val),
    JWT_COOKIE_NAME: val => (config.jwtCookieName = val),
    SOCKET_RESPONSE_TIMEOUT_MS: val =>
      (config.socketResponseTimeoutMs = toNumber(val)),
    PING_SOCKETS_INTERVAL_MS: val =>
      (config.pingSocketsIntervalMs = toNumber(val)),
    GC_CHANNELS_INTERVAL_MS: val =>
      (config.gcChannelsIntervalMs = toNumber(val)),
    REDIS_HOST: val => (config.redis.host = val),
    REDIS_PORT: val => (config.redis.port = toNumber(val)),
    REDIS_PASSWORD: val => (config.redis.password = val),
    REDIS_DB: val => (config.redis.db = toNumber(val)),
    REDIS_SSL: val => (config.redis.ssl = toBoolean(val)),
    STATSD_HOST: val => (config.statsd.host = val),
    STATSD_PORT: val => (config.statsd.port = toNumber(val)),
    STATSD_GLOBAL_TAGS: val => (config.statsd.globalTags = toStringArray(val)),
  };

  Object.entries(envVarConfigSetter).forEach(([envVar, set]) => {
    const envValue = process.env[envVar];
    if (envValue && isPresent(envValue)) {
      set(envValue);
    }
  });

  return config;
}

export function buildConfig(): ConfigType {
  const config = Object.assign(defaultConfig(), configFromFile());
  return applyEnvOverrides(config);
}
