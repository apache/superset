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

/**
 * The application root, answered for an extension.
 *
 * An extension forms real `href`s to host screens. The root is deployment
 * configuration -- it is not in the extension's bundle, its manifest or
 * anything it can read -- so a bare path is the only thing it could build
 * on its own, and a bare path resolves against the wrong place under a
 * subdirectory deployment or inside a host application's iframe.
 *
 * This is the host's own `ensureAppRoot`, published rather than
 * reimplemented, so the two cannot drift: an extension's link and the
 * host's own link to the same screen are built by the same function.
 */

import { navigation } from '.';

jest.mock('src/utils/pathUtils', () => ({
  ensureAppRoot: jest.fn((path: string) => `/analytics${path}`),
}));

test('a path is rooted at the deployment', () => {
  expect(navigation.appRoot('/explore/?slice_id=42')).toBe(
    '/analytics/explore/?slice_id=42',
  );
});

test('it is the host\'s own ensureAppRoot, not a second copy of it', () => {
  // The point of publishing rather than reimplementing. If this ever stops
  // being the same function, an extension's link and the host's link to the
  // same screen can disagree about where that screen is.
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { ensureAppRoot } = require('src/utils/pathUtils');

  expect(navigation.appRoot).toBe(ensureAppRoot);
});
