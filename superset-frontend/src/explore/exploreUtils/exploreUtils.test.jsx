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
import sinon from 'sinon';

import URI from 'urijs';
import {
  buildV1ChartDataPayload,
  exploreChart,
  exportChart,
  getExploreUrl,
  getSimpleSQLExpression,
  getQuerySettings,
} from 'src/explore/exploreUtils';
import { DashboardStandaloneMode } from 'src/dashboard/util/constants';
import * as hostNamesConfig from 'src/utils/hostNamesConfig';
import { getChartMetadataRegistry, SupersetClient } from '@superset-ui/core';
import * as exportUtils from 'src/utils/export';

const { location } = window;
const formData = {
  datasource: '1__table',
};
function compareURI(uri1, uri2) {
  expect(uri1.toString()).toBe(uri2.toString());
}

test('getExploreUrl generates proper base url', () => {
  // This assertion is to show clearly the value of location.href
  // in the context of unit tests.
  expect(location.href).toBe('http://localhost/');

  const url = getExploreUrl({
    formData,
    endpointType: 'base',
    force: false,
    curUrl: 'http://superset.com',
  });
  compareURI(URI(url), URI('/explore/'));
});

test('getExploreUrl generates proper json url', () => {
  const url = getExploreUrl({
    formData,
    endpointType: 'json',
    force: false,
    curUrl: 'http://superset.com',
  });
  compareURI(URI(url), URI('/superset/explore_json/'));
});

test('getExploreUrl generates proper json forced url', () => {
  const url = getExploreUrl({
    formData,
    endpointType: 'json',
    force: true,
    curUrl: 'superset.com',
  });
  compareURI(
    URI(url),
    URI('/superset/explore_json/').search({ force: 'true' }),
  );
});

test('getExploreUrl generates proper csv URL', () => {
  const url = getExploreUrl({
    formData,
    endpointType: 'csv',
    force: false,
    curUrl: 'superset.com',
  });
  compareURI(URI(url), URI('/superset/explore_json/').search({ csv: 'true' }));
});

test('getExploreUrl generates proper standalone URL', () => {
  const url = getExploreUrl({
    formData,
    endpointType: 'standalone',
    force: false,
    curUrl: 'superset.com',
  });
  compareURI(
    URI(url),
    URI('/explore/').search({
      standalone: DashboardStandaloneMode.HideNav,
    }),
  );
});

test('getExploreUrl preserves main URLs params', () => {
  const url = getExploreUrl({
    formData,
    endpointType: 'json',
    force: false,
    curUrl: 'superset.com?foo=bar',
  });
  compareURI(URI(url), URI('/superset/explore_json/').search({ foo: 'bar' }));
});

test('getExploreUrl generate proper save slice url', () => {
  const url = getExploreUrl({
    formData,
    endpointType: 'json',
    force: false,
    curUrl: 'superset.com?foo=bar',
  });
  compareURI(URI(url), URI('/superset/explore_json/').search({ foo: 'bar' }));
});

let domainShardingStub;
const availableDomains = [
  'http://localhost/',
  'domain1.com',
  'domain2.com',
  'domain3.com',
];

beforeEach(() => {
  domainShardingStub = sinon
    .stub(hostNamesConfig, 'availableDomains')
    .value(availableDomains);
});

afterEach(() => {
  domainShardingStub.restore();
});

test('domain sharding generates url to different domains', () => {
  let url = getExploreUrl({
    formData,
    endpointType: 'json',
    allowDomainSharding: true,
  });
  // skip main domain for fetching chart if domain sharding is enabled
  // to leave main domain free for other calls like fav star, save change, etc.
  expect(url).toMatch(availableDomains[1]);

  url = getExploreUrl({
    formData,
    endpointType: 'json',
    allowDomainSharding: true,
  });
  expect(url).toMatch(availableDomains[2]);

  url = getExploreUrl({
    formData,
    endpointType: 'json',
    allowDomainSharding: true,
  });
  expect(url).toMatch(availableDomains[3]);

  // circle back to first available domain
  url = getExploreUrl({
    formData,
    endpointType: 'json',
    allowDomainSharding: true,
  });
  expect(url).toMatch(availableDomains[1]);
});

test('domain sharding does not generate url to different domains without flag', () => {
  let csvURL = getExploreUrl({
    formData,
    endpointType: 'csv',
  });
  expect(csvURL).toMatch(availableDomains[0]);

  csvURL = getExploreUrl({
    formData,
    endpointType: 'csv',
  });
  expect(csvURL).toMatch(availableDomains[0]);
});

test('buildV1ChartDataPayload generates valid request payload despite no registered buildQuery', async () => {
  const v1RequestPayload = await buildV1ChartDataPayload({
    formData: { ...formData, viz_type: 'my_custom_viz' },
  });
  expect(v1RequestPayload.hasOwnProperty('queries')).toBeTruthy();
});

beforeAll(() => {
  getChartMetadataRegistry()
    .registerValue('my_legacy_viz', { useLegacyApi: true })
    .registerValue('my_v1_viz', { useLegacyApi: false });
});

afterAll(() => {
  getChartMetadataRegistry().remove('my_legacy_viz').remove('my_v1_viz');
});

test('getQuerySettings returns true for legacy viz', () => {
  const [useLegacyApi, parseMethod] = getQuerySettings({
    ...formData,
    viz_type: 'my_legacy_viz',
  });
  expect(useLegacyApi).toBe(true);
  expect(parseMethod).toBe('json-bigint');
});

test('getQuerySettings returns false for v1 viz', () => {
  const [useLegacyApi, parseMethod] = getQuerySettings({
    ...formData,
    viz_type: 'my_v1_viz',
  });
  expect(useLegacyApi).toBe(false);
  expect(parseMethod).toBe('json-bigint');
});

test('getQuerySettings returns false for formData with unregistered viz_type', () => {
  const [useLegacyApi, parseMethod] = getQuerySettings({
    ...formData,
    viz_type: 'undefined_viz',
  });
  expect(useLegacyApi).toBe(false);
  expect(parseMethod).toBe('json-bigint');
});

test('getQuerySettings returns false for formData without viz_type', () => {
  const [useLegacyApi, parseMethod] = getQuerySettings(formData);
  expect(useLegacyApi).toBe(false);
  expect(parseMethod).toBe('json-bigint');
});

test('getSimpleSQLExpression returns empty string when subject is undefined', () => {
  expect(getSimpleSQLExpression(undefined, '=', 10)).toBe('');
  expect(getSimpleSQLExpression()).toBe('');
});

test("getSimpleSQLExpression returns subject when it's provided and operator is undefined", () => {
  expect(getSimpleSQLExpression('col', undefined, 10)).toBe('col');
  expect(getSimpleSQLExpression('col')).toBe('col');
});

test("getSimpleSQLExpression returns subject and operator when they're provided and comparator is undefined", () => {
  expect(getSimpleSQLExpression('col', '=')).toBe('col =');
  expect(getSimpleSQLExpression('col', 'IN')).toBe('col IN');
  expect(getSimpleSQLExpression('col', 'IN', [])).toBe('col IN');
});

test('getSimpleSQLExpression returns full expression when subject, operator and comparator are provided', () => {
  expect(getSimpleSQLExpression('col', '=', 'comp')).toBe("col = 'comp'");
  expect(getSimpleSQLExpression('col', '=', "it's an apostrophe")).toBe(
    "col = 'it''s an apostrophe'",
  );
  expect(getSimpleSQLExpression('col', '=', 0)).toBe('col = 0');
  expect(getSimpleSQLExpression('col', '=', '0')).toBe('col = 0');
  expect(getSimpleSQLExpression('col', 'IN', 'foo')).toBe("col IN ('foo')");
  expect(getSimpleSQLExpression('col', 'NOT IN', ['foo'])).toBe(
    "col NOT IN ('foo')",
  );
  expect(getSimpleSQLExpression('col', 'IN', ['foo', 'bar'])).toBe(
    "col IN ('foo', 'bar')",
  );
  expect(getSimpleSQLExpression('col', 'IN', ['0', '1', '2'])).toBe(
    'col IN (0, 1, 2)',
  );
  expect(getSimpleSQLExpression('col', 'NOT IN', [0, 1, 2])).toBe(
    'col NOT IN (0, 1, 2)',
  );
});

test('exploreChart calls postForm', () => {
  const postFormSpy = jest.spyOn(SupersetClient, 'postForm');
  postFormSpy.mockImplementation(jest.fn());

  exploreChart({
    formData: { ...formData, viz_type: 'my_custom_viz' },
  });
  expect(postFormSpy).toHaveBeenCalledTimes(1);
});

let postBlobSpy;
let downloadBlobSpy;
let mockBlob;

beforeEach(() => {
  // Create a mock blob
  mockBlob = new Blob(['test data'], { type: 'text/csv' });

  // Mock SupersetClient.postBlob
  postBlobSpy = jest.spyOn(SupersetClient, 'postBlob');

  // Mock downloadBlob from utils/export
  downloadBlobSpy = jest.spyOn(exportUtils, 'downloadBlob');
  downloadBlobSpy.mockImplementation(jest.fn());
});

afterEach(() => {
  postBlobSpy.mockRestore();
  downloadBlobSpy.mockRestore();
});

test('exportChart successfully exports chart as CSV', async () => {
  // Mock successful response
  const mockResponse = {
    ok: true,
    status: 200,
    blob: jest.fn().mockResolvedValue(mockBlob),
  };
  postBlobSpy.mockResolvedValue(mockResponse);

  await exportChart({
    formData: { ...formData, viz_type: 'my_custom_viz' },
    resultFormat: 'csv',
    resultType: 'full',
  });

  expect(postBlobSpy).toHaveBeenCalledTimes(1);
  expect(mockResponse.blob).toHaveBeenCalled();
  expect(downloadBlobSpy).toHaveBeenCalledWith(
    mockBlob,
    expect.stringContaining('.csv'),
  );
});

test('exportChart successfully exports chart as Excel', async () => {
  // Mock successful response
  const mockResponse = {
    ok: true,
    status: 200,
    blob: jest.fn().mockResolvedValue(mockBlob),
  };
  postBlobSpy.mockResolvedValue(mockResponse);

  await exportChart({
    formData: { ...formData, viz_type: 'my_custom_viz' },
    resultFormat: 'xlsx',
    resultType: 'results',
  });

  expect(postBlobSpy).toHaveBeenCalledTimes(1);
  expect(mockResponse.blob).toHaveBeenCalled();
  expect(downloadBlobSpy).toHaveBeenCalledWith(
    mockBlob,
    expect.stringContaining('.xlsx'),
  );
});

test('exportChart throws error with status 413 when payload is too large', async () => {
  // Mock 413 response
  const mockResponse = {
    ok: false,
    status: 413,
    statusText: 'Payload Too Large',
    blob: jest.fn(),
  };
  postBlobSpy.mockResolvedValue(mockResponse);

  await expect(
    exportChart({
      formData: { ...formData, viz_type: 'my_custom_viz' },
      resultFormat: 'csv',
    }),
  ).rejects.toMatchObject({
    status: 413,
    message: expect.stringContaining('413'),
  });

  expect(postBlobSpy).toHaveBeenCalledTimes(1);
  // Blob should not be called if response is not ok
  expect(mockResponse.blob).not.toHaveBeenCalled();
  // Download should not be triggered
  expect(downloadBlobSpy).not.toHaveBeenCalled();
});

test('exportChart throws error with status 500 for server errors', async () => {
  // Mock 500 response
  const mockResponse = {
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    blob: jest.fn(),
  };
  postBlobSpy.mockResolvedValue(mockResponse);

  await expect(
    exportChart({
      formData: { ...formData, viz_type: 'my_custom_viz' },
      resultFormat: 'json',
    }),
  ).rejects.toMatchObject({
    status: 500,
    message: expect.stringContaining('500'),
  });

  expect(downloadBlobSpy).not.toHaveBeenCalled();
});

test('exportChart handles Response object errors from SupersetClient', async () => {
  // Mock Response object being thrown
  const mockErrorResponse = new Response('Error body', {
    status: 413,
    statusText: 'Payload Too Large',
  });
  postBlobSpy.mockRejectedValue(mockErrorResponse);

  await expect(
    exportChart({
      formData: { ...formData, viz_type: 'my_custom_viz' },
      resultFormat: 'csv',
    }),
  ).rejects.toMatchObject({
    status: 413,
    message: expect.stringContaining('413'),
  });

  expect(downloadBlobSpy).not.toHaveBeenCalled();
});

test('exportChart enhances errors without status property', async () => {
  // Mock generic error without status
  const genericError = new Error('Network error');
  postBlobSpy.mockRejectedValue(genericError);

  await expect(
    exportChart({
      formData: { ...formData, viz_type: 'my_custom_viz' },
      resultFormat: 'csv',
    }),
  ).rejects.toMatchObject({
    status: 500,
    message: expect.stringContaining('Network error'),
  });

  expect(downloadBlobSpy).not.toHaveBeenCalled();
});

test('exportChart uses streaming export when onStartStreamingExport is provided', async () => {
  const mockStreamingHandler = jest.fn();

  await exportChart({
    formData: { ...formData, viz_type: 'my_custom_viz' },
    resultFormat: 'csv',
    onStartStreamingExport: mockStreamingHandler,
  });

  // Should call the streaming handler instead of postBlob
  expect(mockStreamingHandler).toHaveBeenCalledWith({
    url: expect.any(String),
    payload: expect.any(Object),
    exportType: 'csv',
  });

  // Should not call postBlob when streaming
  expect(postBlobSpy).not.toHaveBeenCalled();
  expect(downloadBlobSpy).not.toHaveBeenCalled();
});

test('exportChart generates correct filename with timestamp', async () => {
  const mockResponse = {
    ok: true,
    status: 200,
    blob: jest.fn().mockResolvedValue(mockBlob),
  };
  postBlobSpy.mockResolvedValue(mockResponse);

  // Mock Date to have consistent timestamp
  const mockDate = new Date('2025-01-14T12:34:56.789Z');
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

  await exportChart({
    formData: { ...formData, viz_type: 'my_custom_viz' },
    resultFormat: 'csv',
  });

  expect(downloadBlobSpy).toHaveBeenCalledWith(
    mockBlob,
    expect.stringMatching(
      /^chart_export_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-.+\.csv$/,
    ),
  );

  // Restore Date
  global.Date.mockRestore();
});
