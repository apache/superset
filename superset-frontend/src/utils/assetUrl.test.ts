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
import * as getBootstrapData from 'src/utils/getBootstrapData';
import { assetUrl, assetUrlIf } from './assetUrl';

const staticAssetsPrefixMock = jest.spyOn(
  getBootstrapData,
  'staticAssetsPrefix',
);
const resourcePath = '/endpoint/img.png';
const absoluteResourcePath = `https://cdn.domain.com/static${resourcePath}`;

beforeEach(() => {
  // Clear app root
  staticAssetsPrefixMock.mockReturnValue('');
});

describe('assetUrl should prepend static asset prefix', () => {
  it.each(['', '/myapp'])("'%s' for relative path", app_root => {
    staticAssetsPrefixMock.mockReturnValue(app_root);
    expect(assetUrl(resourcePath)).toBe(`${app_root}${resourcePath}`);
    expect(assetUrl(absoluteResourcePath)).toBe(
      `${app_root}/${absoluteResourcePath}`,
    );
  });
});

describe('assetUrlIf should ignore static asset prefix', () => {
  it.each(['', '/myapp'])("'%s' for absolute url", app_root => {
    staticAssetsPrefixMock.mockReturnValue(app_root);
    expect(assetUrlIf(resourcePath)).toBe(`${app_root}${resourcePath}`);
    expect(assetUrlIf(absoluteResourcePath)).toBe(absoluteResourcePath);
  });
});
