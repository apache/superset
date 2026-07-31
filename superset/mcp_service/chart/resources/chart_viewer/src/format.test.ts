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

import { expect, it } from 'vitest';

import { stripUntrustedMarkers } from './format';

it('strips the UNTRUSTED-CONTENT wrapper the MCP service adds', () => {
  expect(stripUntrustedMarkers('<UNTRUSTED-CONTENT>\nMonthly Revenue Trend\n</UNTRUSTED-CONTENT>')).toBe(
    'Monthly Revenue Trend',
  );
});

it('leaves an unwrapped string untouched', () => {
  expect(stripUntrustedMarkers('Monthly Revenue Trend')).toBe('Monthly Revenue Trend');
});

it('strips a stray or unbalanced marker rather than leaving a fragment', () => {
  expect(stripUntrustedMarkers('<UNTRUSTED-CONTENT>\nOrders')).toBe('Orders');
  expect(stripUntrustedMarkers('Orders</UNTRUSTED-CONTENT>')).toBe('Orders');
});

it('strips markers embedded mid-string, not just at the edges', () => {
  expect(stripUntrustedMarkers('a <UNTRUSTED-CONTENT>b</UNTRUSTED-CONTENT> c')).toBe('a b c');
});

it('preserves inner angle brackets so escaping stays the renderer job', () => {
  expect(stripUntrustedMarkers('<UNTRUSTED-CONTENT>\n<b>Bold</b>\n</UNTRUSTED-CONTENT>')).toBe(
    '<b>Bold</b>',
  );
});

it('returns an empty string when the payload is only markers', () => {
  expect(stripUntrustedMarkers('<UNTRUSTED-CONTENT>\n\n</UNTRUSTED-CONTENT>')).toBe('');
});
