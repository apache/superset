/*
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

import { NumberFormatter, createThroughputFormatter } from '@superset-ui/core';

test('creates an instance of NumberFormatter', () => {
  const formatter = createThroughputFormatter();
  expect(formatter).toBeInstanceOf(NumberFormatter);
});

test('uses default id and label', () => {
  const formatter = createThroughputFormatter();
  expect(formatter.id).toBe('throughput_format');
  expect(formatter.label).toBe('Throughput formatter');
});

test('accepts a custom id, label and description', () => {
  const formatter = createThroughputFormatter({
    id: 'custom_id',
    label: 'Custom label',
    description: 'Custom description',
  });
  expect(formatter.id).toBe('custom_id');
  expect(formatter.label).toBe('Custom label');
  expect(formatter.description).toBe('Custom description');
});

test('formats bits per second without converting', () => {
  const formatter = createThroughputFormatter();
  expect(formatter(0)).toBe('0bps');
  expect(formatter(500)).toBe('500bps');
  expect(formatter(1500)).toBe('1.5kbps');
  expect(formatter(8888)).toBe('8.89kbps');
  expect(formatter(1000000)).toBe('1Mbps');
  expect(formatter(1500000)).toBe('1.5Mbps');
  expect(formatter(1500000000)).toBe('1.5Gbps');
});

test('scales bits per second across the full range of suffixes', () => {
  const formatter = createThroughputFormatter();
  expect(formatter(Math.pow(1000, 1))).toBe('1kbps');
  expect(formatter(Math.pow(1000, 2))).toBe('1Mbps');
  expect(formatter(Math.pow(1000, 3))).toBe('1Gbps');
  expect(formatter(Math.pow(1000, 4))).toBe('1Tbps');
  expect(formatter(Math.pow(1000, 5))).toBe('1Pbps');
  expect(formatter(Math.pow(1000, 6))).toBe('1Ebps');
  expect(formatter(Math.pow(1000, 7))).toBe('1Zbps');
  expect(formatter(Math.pow(1000, 8))).toBe('1Ybps');
  expect(formatter(Math.pow(1000, 9))).toBe('1Rbps');
  expect(formatter(Math.pow(1000, 10))).toBe('1Qbps');
});

test('converts bytes per second to bits per second with fromBytes', () => {
  const formatter = createThroughputFormatter({ fromBytes: true });
  expect(formatter(0)).toBe('0bps');
  expect(formatter(1)).toBe('8bps');
  expect(formatter(100)).toBe('800bps');
  expect(formatter(125)).toBe('1kbps');
  expect(formatter(1111)).toBe('8.89kbps');
  expect(formatter(187500)).toBe('1.5Mbps');
  expect(formatter(1000000)).toBe('8Mbps');
  expect(formatter(125000000)).toBe('1Gbps');
});

test('scales bytes per second across the full range of suffixes', () => {
  const formatter = createThroughputFormatter({ fromBytes: true });
  expect(formatter(Math.pow(1000, 1) / 8)).toBe('1kbps');
  expect(formatter(Math.pow(1000, 5) / 8)).toBe('1Pbps');
  expect(formatter(Math.pow(1000, 10) / 8)).toBe('1Qbps');
});

test('promotes to the next suffix when rounding reaches the base', () => {
  const formatter = createThroughputFormatter();
  expect(formatter(999.999)).toBe('1kbps');
  expect(formatter(999999)).toBe('1Mbps');
  expect(formatter(999999999)).toBe('1Gbps');
  expect(formatter(-999999)).toBe('-1Mbps');

  const fromBytes = createThroughputFormatter({ fromBytes: true });
  expect(fromBytes(124999.99)).toBe('1Mbps');

  const formatter0decimals = createThroughputFormatter({ decimals: 0 });
  expect(formatter0decimals(999.6)).toBe('1kbps');
});

test('clamps to the largest suffix beyond the known range', () => {
  const formatter = createThroughputFormatter();
  expect(formatter(Math.pow(1000, 11))).toBe('1000Qbps');
  expect(formatter(Math.pow(1000, 12))).toBe('1000000Qbps');
});

test('clamps to the smallest suffix below one bit per second', () => {
  const formatter = createThroughputFormatter();
  expect(formatter(0.4)).toBe('0.4bps');

  const fromBytes = createThroughputFormatter({ fromBytes: true });
  expect(fromBytes(0.05)).toBe('0.4bps');
});

test('formats negative rates', () => {
  const formatter = createThroughputFormatter();
  expect(formatter(-1500)).toBe('-1.5kbps');

  const fromBytes = createThroughputFormatter({ fromBytes: true });
  expect(fromBytes(-187500)).toBe('-1.5Mbps');
});

test('rounds according to the decimals option', () => {
  const formatter0decimals = createThroughputFormatter({ decimals: 0 });
  expect(formatter0decimals(0)).toBe('0bps');
  expect(formatter0decimals(8888)).toBe('9kbps');

  const formatter3decimals = createThroughputFormatter({ decimals: 3 });
  expect(formatter3decimals(8888)).toBe('8.888kbps');
});
