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
import React from 'react';
import { isFrontendRoute, routes } from './routes';

jest.mock('src/featureFlags', () => ({
  ...jest.requireActual<object>('src/featureFlags'),
  isFeatureEnabled: jest.fn().mockReturnValue(true),
}));
jest.mock('src/views/CRUD/welcome/Welcome', () => () => (
  <div data-test="mock-welcome" />
));

describe('isFrontendRoute', () => {
  it('returns true if a route matches', () => {
    routes.forEach(r => {
      expect(isFrontendRoute(r.path)).toBe(true);
    });
  });

  it('returns false if a route does not match', () => {
    expect(isFrontendRoute('/non-existent/path/')).toBe(false);
  });
});
