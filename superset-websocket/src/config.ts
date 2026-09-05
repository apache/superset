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

import { readFileSync } from 'fs';
import { merge as _merge } from 'lodash-es';
import { resolve } from 'path';

export interface RedisConfig {
  port: number;
  host: string;
  password: string;
  username: string;
  db: number;
  ssl: boolean;
  validateHostname: boolean;
}

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
  redis: RedisConfig;
  jwtAlgorithms: string[];
  jwtSecret: string;
  previousJwtSecret: string;
  jwtCookieName: string;
  realtimeChannelPrefix: string;
  allowedOrigins: string[];
  socketResponseTimeoutMs: number;
  pingSocketsIntervalMs: number;
  gcChannelsIntervalMs: number;
  maxSocketBufferBytes: number;
  maxConnectionsPerChannel: number;
  maxTotalConnections: number;
};

function defaultConfig(): ConfigType {
  return {
    port: 8080,
    logLevel: 'info',
    logToFile: false,
    logFilename: 'app.log',
    jwtAlgorithms: ['HS256'],
    jwtSecret: '',
    previousJwtSecret: '',
    jwtCookieName: 'superset-ws-token',
    realtimeChannelPrefix: '',
    allowedOrigins: [],
    socketResponseTimeoutMs: 60 * 1000,
    pingSocketsIntervalMs: 20 * 1000,
    gcChannelsIntervalMs: 120 * 1000,
    // 0 disables the per-socket send-buffer cap; set a positive byte value to
    // opt in to terminating clients whose outbound buffer grows beyond it.
    maxSocketBufferBytes: 0,
    // 0 disables the limit (unlimited); set a positive value to opt in.
    maxConnectionsPerChannel: 0,
    maxTotalConnections: 0,
    statsd: {
      host: '127.0.0.1',
      port: 8125,
      globalTags: [],
    },
    redis: {
      host: '127.0.0.1',
      port: 6379,
      password: '',
      username: 'default',
      db: 0,
      ssl: false,
      validateHostname: true,
    },
  };
}

function configFromFile(): Partial<ConfigType> {
  const isTest = process.env.NODE_ENV === 'test';
  const configFile = isTest ? '../config.test.json' : '../config.json';
  const configFilePath = resolve(import.meta.dirname, configFile);
  try {
    return JSON.parse(readFileSync(configFilePath, 'utf8')) as ConfigType;
  } catch {
    // A config file is optional: the container images configure the server
    // entirely through environment variables.
    console.warn(
      `No config file at ${configFilePath}; using defaults plus any ` +
        'environment variable overrides',
    );
    return {};
  }
}

const isPresent = (s: string) => /\S+/.test(s);

// Parse a non-negative numeric env override, ignoring malformed input.
// Returns the fallback (and logs a warning) when the value is not a finite
// number >= 0, so a misconfiguration can't silently disable the feature.
function toNonNegativeNumber(val: string, fallback: number): number {
  const parsed = Number(val);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(
      `Invalid numeric config value "${val}"; expected a non-negative ` +
        `number. Falling back to ${fallback}.`,
    );
    return fallback;
  }
  return parsed;
}
const toBoolean = (s: string) => s.toLowerCase() === 'true';
const toStringArray = (s: string) =>
  s
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);

function applyEnvOverrides(config: ConfigType): ConfigType {
  // Every numeric override goes through `toNonNegativeNumber` so a typo'd value
  // falls back to the default with a warning rather than silently becoming NaN
  // (which would compare falsy against every threshold and disable the limit).
  const envVarConfigSetter: { [envVar: string]: (val: string) => void } = {
    PORT: val => (config.port = toNonNegativeNumber(val, config.port)),
    LOG_LEVEL: val => (config.logLevel = val),
    LOG_TO_FILE: val => (config.logToFile = toBoolean(val)),
    LOG_FILENAME: val => (config.logFilename = val),
    JWT_SECRET: val => (config.jwtSecret = val),
    PREVIOUS_JWT_SECRET: val => (config.previousJwtSecret = val),
    JWT_COOKIE_NAME: val => (config.jwtCookieName = val),
    REALTIME_CHANNEL_PREFIX: val => (config.realtimeChannelPrefix = val),
    ALLOWED_ORIGINS: val => (config.allowedOrigins = toStringArray(val)),
    SOCKET_RESPONSE_TIMEOUT_MS: val =>
      (config.socketResponseTimeoutMs = toNonNegativeNumber(
        val,
        config.socketResponseTimeoutMs,
      )),
    PING_SOCKETS_INTERVAL_MS: val =>
      (config.pingSocketsIntervalMs = toNonNegativeNumber(
        val,
        config.pingSocketsIntervalMs,
      )),
    GC_CHANNELS_INTERVAL_MS: val =>
      (config.gcChannelsIntervalMs = toNonNegativeNumber(
        val,
        config.gcChannelsIntervalMs,
      )),
    MAX_SOCKET_BUFFER_BYTES: val =>
      (config.maxSocketBufferBytes = toNonNegativeNumber(
        val,
        config.maxSocketBufferBytes,
      )),
    MAX_CONNECTIONS_PER_CHANNEL: val =>
      (config.maxConnectionsPerChannel = toNonNegativeNumber(
        val,
        config.maxConnectionsPerChannel,
      )),
    MAX_TOTAL_CONNECTIONS: val =>
      (config.maxTotalConnections = toNonNegativeNumber(
        val,
        config.maxTotalConnections,
      )),
    REDIS_HOST: val => (config.redis.host = val),
    REDIS_PORT: val =>
      (config.redis.port = toNonNegativeNumber(val, config.redis.port)),
    REDIS_PASSWORD: val => (config.redis.password = val),
    REDIS_USERNAME: val => (config.redis.username = val),
    REDIS_DB: val =>
      (config.redis.db = toNonNegativeNumber(val, config.redis.db)),
    REDIS_SSL: val => (config.redis.ssl = toBoolean(val)),
    STATSD_HOST: val => (config.statsd.host = val),
    STATSD_PORT: val =>
      (config.statsd.port = toNonNegativeNumber(val, config.statsd.port)),
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
  const config = _merge(defaultConfig(), configFromFile());
  return applyEnvOverrides(config);
}
