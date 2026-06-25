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
import { recoveredToast } from './softDeleteCopy';

test('recoveredToast links to the asset and enables HTML when a url is present', () => {
  const { text, options } = recoveredToast(
    'My Chart',
    'Chart',
    '/explore/?slice_id=1',
  );
  expect(text).toContain('My Chart restored successfully');
  expect(text).toContain('<a href="/explore/?slice_id=1">');
  expect(text).toContain('View Chart');
  expect(options).toEqual({ allowHtml: true });
});

test('recoveredToast is plain text with no html when there is no url', () => {
  const { text, options } = recoveredToast('My Chart', 'Chart');
  expect(text).toBe('My Chart restored successfully');
  expect(options).toBeUndefined();
});

test('recoveredToast escapes HTML in the asset name', () => {
  const { text } = recoveredToast('<b>x</b>', 'Chart', '/u');
  expect(text).toContain('&lt;b&gt;x&lt;/b&gt;');
  expect(text).not.toContain('<b>x</b>');
});
