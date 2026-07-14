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
import { assetUrl, ensureStaticPrefix } from './assetUrl';

const staticAssetsPrefixMock = jest.spyOn(
  getBootstrapData,
  'staticAssetsPrefix',
);
const resourcePath = '/endpoint/img.png';
const absoluteResourcePath = `https://cdn.domain.com/static${resourcePath}`;

beforeEach(() => {
  staticAssetsPrefixMock.mockReturnValue('');
});

describe('assetUrl should prepend static asset prefix for relative paths', () => {
  test.each(['', '/myapp'])("'%s' for relative path", app_root => {
    staticAssetsPrefixMock.mockReturnValue(app_root);
    expect(assetUrl(resourcePath)).toBe(`${app_root}${resourcePath}`);
    expect(assetUrl(absoluteResourcePath)).toBe(
      `${app_root}/${absoluteResourcePath}`,
    );
  });
});

describe('assetUrl should ignore static asset prefix for absolute URLs', () => {
  test.each(['', '/myapp'])("'%s' for absolute url", app_root => {
    staticAssetsPrefixMock.mockReturnValue(app_root);
    expect(ensureStaticPrefix(absoluteResourcePath)).toBe(absoluteResourcePath);
  });
});

describe('ensureStaticPrefix should be idempotent', () => {
  test('does not double-prefix a path that already starts with the static-assets prefix', () => {
    staticAssetsPrefixMock.mockReturnValue('/superset');
    const alreadyRooted =
      '/superset/static/assets/images/superset-logo-horiz.png';
    expect(ensureStaticPrefix(alreadyRooted)).toBe(alreadyRooted);
  });

  test('still prefixes a relative path that does not yet carry the prefix', () => {
    staticAssetsPrefixMock.mockReturnValue('/superset');
    expect(ensureStaticPrefix('/static/assets/x.png')).toBe(
      '/superset/static/assets/x.png',
    );
  });

  test('treats segment boundaries — `/supersetfoo` is not the same as `/superset`', () => {
    staticAssetsPrefixMock.mockReturnValue('/superset');
    expect(ensureStaticPrefix('/supersetfoo/img.png')).toBe(
      '/superset/supersetfoo/img.png',
    );
  });

  test('handles nested application roots', () => {
    staticAssetsPrefixMock.mockReturnValue('/preset/superset');
    const alreadyRooted = '/preset/superset/static/x.png';
    expect(ensureStaticPrefix(alreadyRooted)).toBe(alreadyRooted);
  });

  test('returns the prefix itself unchanged when passed in bare', () => {
    staticAssetsPrefixMock.mockReturnValue('/superset');
    expect(ensureStaticPrefix('/superset')).toBe('/superset');
  });

  test('is a no-op when the static-assets prefix is empty (root deployment)', () => {
    staticAssetsPrefixMock.mockReturnValue('');
    expect(ensureStaticPrefix('/static/x.png')).toBe('/static/x.png');
  });
});
