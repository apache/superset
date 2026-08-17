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
  API_KEY_SCOPE_OPTIONS,
  getApiKeyScopesHelpText,
  serializeApiKeyScopes,
} from './apiKeyScopes';

test('offers read and write scopes for every supported resource', () => {
  expect(API_KEY_SCOPE_OPTIONS).toHaveLength(32);
  expect(API_KEY_SCOPE_OPTIONS).toContainEqual({
    label: 'superset:dashboard:read',
    value: 'superset:dashboard:read',
  });
  expect(API_KEY_SCOPE_OPTIONS).toContainEqual({
    label: 'superset:sqllab:write',
    value: 'superset:sqllab:write',
  });
});

test('serializes selected scopes for the FAB API', () => {
  expect(
    serializeApiKeyScopes(['superset:dashboard:read', 'superset:chart:write']),
  ).toBe('superset:dashboard:read,superset:chart:write');
  expect(serializeApiKeyScopes([])).toBeUndefined();
  expect(serializeApiKeyScopes()).toBeUndefined();
});

test('explains that scopes apply to MCP rather than REST APIs', () => {
  expect(getApiKeyScopesHelpText()).toContain('MCP resources');
  expect(getApiKeyScopesHelpText()).toContain(
    'do not restrict REST API requests',
  );
});
