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
import { buildConfig } from '../src/config';

test('buildConfig() builds configuration and applies env var overrides', () => {
  let config = buildConfig();

  expect(config.jwtSecret).toEqual(
    'test123-test123-test123-test123-test123-test123-test123',
  );
  expect(config.redis.host).toEqual('127.0.0.1');
  expect(config.redis.port).toEqual(6379);
  expect(config.redis.password).toEqual('');
  expect(config.redis.db).toEqual(10);
  expect(config.redis.ssl).toEqual(false);
  expect(config.statsd.host).toEqual('127.0.0.1');
  expect(config.statsd.port).toEqual(8125);
  expect(config.statsd.globalTags).toEqual([]);

  process.env.JWT_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  process.env.REDIS_HOST = '10.10.10.10';
  process.env.REDIS_PORT = '6380';
  process.env.REDIS_PASSWORD = 'admin';
  process.env.REDIS_DB = '4';
  process.env.REDIS_SSL = 'true';
  process.env.STATSD_HOST = '15.15.15.15';
  process.env.STATSD_PORT = '8000';
  process.env.STATSD_GLOBAL_TAGS = 'tag-1,tag-2';

  config = buildConfig();

  expect(config.jwtSecret).toEqual('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  expect(config.redis.host).toEqual('10.10.10.10');
  expect(config.redis.port).toEqual(6380);
  expect(config.redis.password).toEqual('admin');
  expect(config.redis.db).toEqual(4);
  expect(config.redis.ssl).toEqual(true);
  expect(config.statsd.host).toEqual('15.15.15.15');
  expect(config.statsd.port).toEqual(8000);
  expect(config.statsd.globalTags).toEqual(['tag-1', 'tag-2']);

  delete process.env.JWT_SECRET;
  delete process.env.REDIS_HOST;
  delete process.env.REDIS_PORT;
  delete process.env.REDIS_PASSWORD;
  delete process.env.REDIS_DB;
  delete process.env.REDIS_SSL;
  delete process.env.STATSD_HOST;
  delete process.env.STATSD_PORT;
  delete process.env.STATSD_GLOBAL_TAGS;
});
