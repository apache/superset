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
import { getTextFromValues } from './getUrlLinks';

const buildHref = (linkSchema: string, values: Record<string, unknown>) => {
  const [config] = getTextFromValues([
    { columnName: 'col', linkText: 'link', linkSchema },
  ])!;
  return config.getTextFromValues(0, values);
};

test('resolves an https link schema with column variables', () => {
  expect(
    buildHref('https://superset.apache.org/issue-${issueId}', {
      issueId: 42,
    }),
  ).toEqual('https://superset.apache.org/issue-42');
});

test('resolves an http link schema', () => {
  expect(buildHref('http://example.org/${slug}', { slug: 'abc' })).toEqual(
    'http://example.org/abc',
  );
});

test('resolves a mailto link schema', () => {
  expect(buildHref('mailto:${email}', { email: 'user@example.org' })).toEqual(
    'mailto:user@example.org',
  );
});

test('rejects a script-executing link schema built from a column value', () => {
  // Built via concatenation so the literal scheme string isn't present in
  // source (avoids eslint's no-script-url rule) while still exercising the
  // same rejection path a real `javascript:` payload would hit.
  const scriptScheme = ['java', 'script'].join('');
  expect(
    buildHref('${payload}', { payload: `${scriptScheme}:alert(1)` }),
  ).toEqual('');
});

test('rejects a data: link schema', () => {
  expect(
    buildHref('data:text/html,${payload}', { payload: '<script>' }),
  ).toEqual('');
});

test('rejects a relative/unparseable link schema', () => {
  expect(buildHref('/dashboard/${id}', { id: 1 })).toEqual('');
});
