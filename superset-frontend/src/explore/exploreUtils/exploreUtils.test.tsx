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
  getExploreUrl,
  getSimpleSQLExpression,
  getQuerySettings,
} from 'src/explore/exploreUtils';
import { DashboardStandaloneMode } from 'src/dashboard/util/constants';
import * as hostNamesConfig from 'src/utils/hostNamesConfig';
import {
  getChartMetadataRegistry,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('exploreUtils', () => {
  const { location } = window;
  const formData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'table',
  };
  function compareURI(uri1: URI, uri2: URI): void {
    expect(uri1.toString()).toBe(uri2.toString());
  }

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('getExploreUrl', () => {
    test('generates proper base url', () => {
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
    test('generates proper json url', () => {
      const url = getExploreUrl({
        formData,
        endpointType: 'json',
        force: false,
        curUrl: 'http://superset.com',
      });
      compareURI(URI(url), URI('/superset/explore_json/'));
    });
    test('generates proper json forced url', () => {
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
    test('generates proper csv URL', () => {
      const url = getExploreUrl({
        formData,
        endpointType: 'csv',
        force: false,
        curUrl: 'superset.com',
      });
      compareURI(
        URI(url),
        URI('/superset/explore_json/').search({ csv: 'true' }),
      );
    });
    test('generates proper standalone URL', () => {
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
    test('preserves main URLs params', () => {
      const url = getExploreUrl({
        formData,
        endpointType: 'json',
        force: false,
        curUrl: 'superset.com?foo=bar',
      });
      compareURI(
        URI(url),
        URI('/superset/explore_json/').search({ foo: 'bar' }),
      );
    });
    test('generate proper save slice url', () => {
      const url = getExploreUrl({
        formData,
        endpointType: 'json',
        force: false,
        curUrl: 'superset.com?foo=bar',
      });
      compareURI(
        URI(url),
        URI('/superset/explore_json/').search({ foo: 'bar' }),
      );
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('domain sharding', () => {
    let stub: sinon.SinonStub;
    const availableDomains = [
      'http://localhost/',
      'domain1.com',
      'domain2.com',
      'domain3.com',
    ];
    beforeEach(() => {
      stub = sinon
        .stub(hostNamesConfig, 'availableDomains')
        .value(availableDomains);
    });
    afterEach(() => {
      stub.restore();
    });

    test('generate url to different domains', () => {
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
    test('not generate url to different domains without flag', () => {
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
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('buildV1ChartDataPayload', () => {
    test('generate valid request payload despite no registered buildQuery', async () => {
      const v1RequestPayload = await buildV1ChartDataPayload({
        formData: { ...formData, viz_type: 'my_custom_viz' },
      });
      expect(
        Object.prototype.hasOwnProperty.call(v1RequestPayload, 'queries'),
      ).toBeTruthy();
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('getQuerySettings', () => {
    beforeAll(() => {
      getChartMetadataRegistry()
        .registerValue('my_legacy_viz', { useLegacyApi: true })
        .registerValue('my_v1_viz', { useLegacyApi: false });
    });

    afterAll(() => {
      getChartMetadataRegistry().remove('my_legacy_viz').remove('my_v1_viz');
    });

    test('returns true for legacy viz', () => {
      const [useLegacyApi, parseMethod] = getQuerySettings({
        ...formData,
        viz_type: 'my_legacy_viz',
      });
      expect(useLegacyApi).toBe(true);
      expect(parseMethod).toBe('json-bigint');
    });

    test('returns false for v1 viz', () => {
      const [useLegacyApi, parseMethod] = getQuerySettings({
        ...formData,
        viz_type: 'my_v1_viz',
      });
      expect(useLegacyApi).toBe(false);
      expect(parseMethod).toBe('json-bigint');
    });

    test('returns false for formData with unregistered viz_type', () => {
      const [useLegacyApi, parseMethod] = getQuerySettings({
        ...formData,
        viz_type: 'undefined_viz',
      });
      expect(useLegacyApi).toBe(false);
      expect(parseMethod).toBe('json-bigint');
    });

    test('returns false for formData without viz_type', () => {
      const [useLegacyApi, parseMethod] = getQuerySettings(formData);
      expect(useLegacyApi).toBe(false);
      expect(parseMethod).toBe('json-bigint');
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('getSimpleSQLExpression', () => {
    test('returns empty string when subject is undefined', () => {
      expect(getSimpleSQLExpression(undefined, '=', 10)).toBe('');
      expect(getSimpleSQLExpression()).toBe('');
    });
    test("returns subject when it's provided and operator is undefined", () => {
      expect(getSimpleSQLExpression('col', undefined, 10)).toBe('col');
      expect(getSimpleSQLExpression('col')).toBe('col');
    });
    test("returns subject and operator when they're provided and comparator is undefined", () => {
      expect(getSimpleSQLExpression('col', '=')).toBe('col =');
      expect(getSimpleSQLExpression('col', 'IN')).toBe('col IN');
      expect(getSimpleSQLExpression('col', 'IN', [])).toBe('col IN');
    });
    test('returns full expression when subject, operator and comparator are provided', () => {
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
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('.exploreChart()', () => {
    test('postForm', () => {
      const postFormSpy = jest.spyOn(SupersetClient, 'postForm');
      postFormSpy.mockImplementation(jest.fn());

      exploreChart({ ...formData, viz_type: 'my_custom_viz' });
      expect(postFormSpy).toHaveBeenCalledTimes(1);
    });
  });
});
