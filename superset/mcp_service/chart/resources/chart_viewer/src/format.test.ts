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
import { describe, expect, it } from 'vitest';
import { stripUntrustedMarkers } from './format';

describe('stripUntrustedMarkers', () => {
  it('removes a complete delimiter pair', () => {
    expect(
      stripUntrustedMarkers(
        '<UNTRUSTED-CONTENT> Monthly Revenue </UNTRUSTED-CONTENT>',
      ),
    ).toBe('Monthly Revenue');
  });

  it('removes repeated delimiters', () => {
    expect(
      stripUntrustedMarkers(
        '<UNTRUSTED-CONTENT>A</UNTRUSTED-CONTENT> <UNTRUSTED-CONTENT>B</UNTRUSTED-CONTENT>',
      ),
    ).toBe('A B');
  });

  it('removes an opening delimiter by itself', () => {
    expect(stripUntrustedMarkers('<UNTRUSTED-CONTENT>value')).toBe('value');
  });

  it('removes a closing delimiter by itself', () => {
    expect(stripUntrustedMarkers('value</UNTRUSTED-CONTENT>')).toBe('value');
  });

  it('preserves unrelated angle brackets for React to escape', () => {
    expect(
      stripUntrustedMarkers(
        '<UNTRUSTED-CONTENT><script>alert(1)</script></UNTRUSTED-CONTENT>',
      ),
    ).toBe('<script>alert(1)</script>');
  });

  it('leaves ordinary text unchanged', () => {
    expect(stripUntrustedMarkers('Monthly Revenue')).toBe('Monthly Revenue');
  });
});
