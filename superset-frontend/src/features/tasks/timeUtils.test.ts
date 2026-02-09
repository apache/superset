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

import {
  formatDuration,
  calculateEta,
  formatProgressTooltip,
} from './timeUtils';

test('formatDuration returns null for invalid inputs', () => {
  expect(formatDuration(null)).toBeNull();
  expect(formatDuration(undefined)).toBeNull();
  expect(formatDuration(0)).toBeNull();
  expect(formatDuration(-5)).toBeNull();
});

test('formatDuration formats seconds correctly', () => {
  expect(formatDuration(37.5)).toBe('37s');
  expect(formatDuration(1)).toBe('1s');
  expect(formatDuration(30)).toBe('30s');
});

test('formatDuration formats minutes correctly', () => {
  expect(formatDuration(60)).toBe('1m');
  expect(formatDuration(90)).toBe('1m 30s');
  expect(formatDuration(150)).toBe('2m 30s');
});

test('formatDuration formats hours correctly', () => {
  expect(formatDuration(3600)).toBe('1h');
  expect(formatDuration(3660)).toBe('1h 1m');
  expect(formatDuration(7200)).toBe('2h');
});

test('calculateEta returns null for invalid inputs', () => {
  expect(calculateEta(null, 60)).toBeNull();
  expect(calculateEta(undefined, 60)).toBeNull();
  expect(calculateEta(0.5, null)).toBeNull();
  expect(calculateEta(0.5, undefined)).toBeNull();
});

test('calculateEta returns null for edge case progress values', () => {
  // No progress yet
  expect(calculateEta(0, 60)).toBeNull();
  // Already complete
  expect(calculateEta(1, 60)).toBeNull();
  // Negative progress (invalid)
  expect(calculateEta(-0.1, 60)).toBeNull();
  // Over 100% (invalid)
  expect(calculateEta(1.1, 60)).toBeNull();
});

test('calculateEta calculates correct remaining time', () => {
  // 50% done in 60s -> ETA = 60s remaining
  expect(calculateEta(0.5, 60)).toBe('1m');

  // 30% done in 60s -> remaining = (60/0.3) * 0.7 = 140s
  expect(calculateEta(0.3, 60)).toBe('2m 20s');

  // 10% done in 10s -> remaining = (10/0.1) * 0.9 = 90s
  expect(calculateEta(0.1, 10)).toBe('1m 30s');

  // 90% done in 90s -> remaining = (90/0.9) * 0.1 = 10s
  expect(calculateEta(0.9, 90)).toBe('10s');
});

test('calculateEta returns null for ETAs over 24 hours', () => {
  // 0.1% done in 100s -> remaining = (100/0.001) * 0.999 = ~99900s > 86400s
  expect(calculateEta(0.001, 100)).toBeNull();
});

test('formatProgressTooltip returns label only when no progress data', () => {
  expect(formatProgressTooltip('In Progress')).toEqual(['In Progress']);
  expect(formatProgressTooltip('In Progress', null, null, null, null)).toEqual([
    'In Progress',
  ]);
});

test('formatProgressTooltip formats count and total correctly', () => {
  expect(formatProgressTooltip('In Progress', 9, 60)).toEqual([
    'In Progress: 9 of 60',
  ]);
});

test('formatProgressTooltip formats count only correctly', () => {
  expect(formatProgressTooltip('In Progress', 42)).toEqual([
    'In Progress: 42 processed',
  ]);
  expect(formatProgressTooltip('In Progress', 42, null)).toEqual([
    'In Progress: 42 processed',
  ]);
});

test('formatProgressTooltip formats percentage correctly', () => {
  expect(formatProgressTooltip('In Progress', null, null, 0.5)).toEqual([
    'In Progress: 50%',
  ]);
  expect(formatProgressTooltip('In Progress', null, null, 0.333)).toEqual([
    'In Progress: 33%',
  ]);
});

test('formatProgressTooltip combines count, total, and percentage', () => {
  expect(formatProgressTooltip('In Progress', 9, 60, 0.15)).toEqual([
    'In Progress: 9 of 60 (15%)',
  ]);
});

test('formatProgressTooltip includes ETA when duration is provided', () => {
  // 50% done in 60s -> ETA = 60s = ~1m
  expect(formatProgressTooltip('In Progress', 30, 60, 0.5, 60)).toEqual([
    'In Progress: 30 of 60 (50%)',
    'ETA: 1m',
  ]);
});

test('formatProgressTooltip works with percentage and ETA only', () => {
  // 25% done in 30s -> ETA = (30/0.25) * 0.75 = 90s = 1m 30s
  expect(formatProgressTooltip('In Progress', null, null, 0.25, 30)).toEqual([
    'In Progress: 25%',
    'ETA: 1m 30s',
  ]);
});

test('formatProgressTooltip works with different labels', () => {
  expect(formatProgressTooltip('Aborting', 5, 10, 0.5)).toEqual([
    'Aborting: 5 of 10 (50%)',
  ]);
});
