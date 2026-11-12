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
 * QA-22: where "Open live version" actually sends somebody.
 *
 * These are real `href`s, not router pushes, so they carry the
 * deployment's application root. Core rooted all three and asserted it
 * here; the file was deleted with the screens it tested and the extension
 * went back to bare paths, which resolve against the wrong place under a
 * subdirectory deployment or inside a host application's iframe.
 *
 * The root is deployment configuration an extension cannot read, so the
 * host answers through `navigation.appRoot`. These tests drive it.
 */

import { navigation } from '@apache-superset/core';
import { assetUrl } from './display';
import type { ChangeRequest } from './types';

const request = (asset_type: string, asset_id = 42) =>
  ({ id: 1, asset_type, asset_id }) as unknown as ChangeRequest;

const appRoot = navigation.appRoot as unknown as jest.Mock;

afterEach(() => {
  appRoot.mockReset();
  appRoot.mockImplementation((path: string) => path);
});

test('[QA-22] a dashboard link is rooted, not bare', () => {
  appRoot.mockImplementation((path: string) => `/analytics${path}`);

  expect(assetUrl(request('dashboard', 7))).toBe(
    '/analytics/superset/dashboard/7/',
  );
});

test('[QA-22] a chart link is rooted, query string and all', () => {
  appRoot.mockImplementation((path: string) => `/analytics${path}`);

  expect(assetUrl(request('chart', 9))).toBe(
    '/analytics/explore/?slice_id=9',
  );
});

test('[QA-22] and the dataset list, which has no id of its own', () => {
  appRoot.mockImplementation((path: string) => `/analytics${path}`);

  expect(assetUrl(request('dataset'))).toBe('/analytics/tablemodelview/list/');
});

test('[QA-22] every asset type asks the host rather than building its own path', () => {
  // The structural half. Rooting two of three is the state this row was
  // raised about, and it reads as correct from any single example.
  ['dashboard', 'chart', 'dataset'].forEach(assetType =>
    assetUrl(request(assetType)),
  );

  expect(appRoot).toHaveBeenCalledTimes(3);
});

test('at the domain root the link is unchanged', () => {
  // The common deployment: rooting must be invisible when there is no root,
  // or this fix would itself be a change in behaviour for everybody else.
  expect(assetUrl(request('chart', 9))).toBe('/explore/?slice_id=9');
});
