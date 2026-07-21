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

import { bytesToBase64, resolveSetPayload } from './binaryCodec';

test('bytesToBase64 encodes bytes to a base64 string', () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  expect(bytesToBase64(bytes)).toBe(btoa('\x89PNG'));
});

test('resolveSetPayload passes through a plain number with the json codec', () => {
  expect(resolveSetPayload(1, undefined)).toEqual({
    value: 1,
    codec: 'json',
    isBinary: false,
  });
});

test('resolveSetPayload passes through a plain object with the json codec', () => {
  expect(resolveSetPayload({ a: 1 }, undefined)).toEqual({
    value: { a: 1 },
    codec: 'json',
    isBinary: false,
  });
});

test('resolveSetPayload does not base64-encode a Uint8Array unless isBinary is true', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  expect(resolveSetPayload(bytes, undefined)).toEqual({
    value: bytes,
    codec: 'json',
    isBinary: false,
  });
});

test('resolveSetPayload base64-encodes a Uint8Array when isBinary is true', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  expect(resolveSetPayload(bytes, { isBinary: true })).toEqual({
    value: bytesToBase64(bytes),
    codec: 'binary',
    isBinary: true,
  });
});

test('resolveSetPayload base64-encodes an ArrayBuffer when isBinary is true', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  expect(resolveSetPayload(bytes.buffer, { isBinary: true })).toEqual({
    value: bytesToBase64(bytes),
    codec: 'binary',
    isBinary: true,
  });
});

test('resolveSetPayload base64-encodes a Uint8Array when isBinary is true, even with an explicit codec', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  expect(resolveSetPayload(bytes, { codec: 'pickle', isBinary: true })).toEqual({
    value: bytesToBase64(bytes),
    codec: 'pickle',
    isBinary: true,
  });
});

test('resolveSetPayload respects an explicit codec for a non-binary value and does not flag isBinary', () => {
  expect(resolveSetPayload('sk-...', { codec: 'pickle' })).toEqual({
    value: 'sk-...',
    codec: 'pickle',
    isBinary: false,
  });
});

test('resolveSetPayload does not double-encode a caller-provided base64 string, and flags isBinary when told to', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const preEncoded = bytesToBase64(bytes);
  expect(
    resolveSetPayload(preEncoded, { codec: 'binary', isBinary: true }),
  ).toEqual({
    value: preEncoded,
    codec: 'binary',
    isBinary: true,
  });
});

test('resolveSetPayload does not flag isBinary for a caller-provided string unless told to', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const preEncoded = bytesToBase64(bytes);
  expect(resolveSetPayload(preEncoded, { codec: 'binary' })).toEqual({
    value: preEncoded,
    codec: 'binary',
    isBinary: false,
  });
});
