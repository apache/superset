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
import { sanitizeDocumentTitle } from './sanitizeDocumentTitle';

describe('sanitizeDocumentTitle', () => {
  it('removes backspace and other C0 controls except tab/LF/CR', () => {
    expect(sanitizeDocumentTitle('a\x08b')).toBe('ab');
    expect(sanitizeDocumentTitle('x\x09y')).toBe('x\ty');
    expect(sanitizeDocumentTitle('x\ny')).toBe('x\ny');
    expect(sanitizeDocumentTitle('x\ry')).toBe('x\ry');
  });

  it('removes DEL and C1 controls', () => {
    expect(sanitizeDocumentTitle('a\x7fb')).toBe('ab');
    expect(sanitizeDocumentTitle('a\x9fb')).toBe('ab');
  });

  it('leaves normal text unchanged', () => {
    expect(sanitizeDocumentTitle('Dashboard 你好')).toBe('Dashboard 你好');
  });
});
