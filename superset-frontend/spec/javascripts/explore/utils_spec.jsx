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
  getExploreUrl,
  getExploreLongUrl,
  shouldUseLegacyApi,
} from 'src/explore/exploreUtils';
import {
  buildTimeRangeString,
  formatTimeRange,
} from 'src/explore/dateFilterUtils';
import * as hostNamesConfig from 'src/utils/hostNamesConfig';
import { getChartMetadataRegistry } from '@superset-ui/chart';

describe('exploreUtils', () => {
  const location = window.location;
  const formData = {
    datasource: '1__table',
  };
  const sFormData = JSON.stringify(formData);
  function compareURI(uri1, uri2) {
    expect(uri1.toString()).toBe(uri2.toString());
  }

  describe('getExploreUrl', () => {
    it('generates proper base url', () => {
      // This assertion is to show clearly the value of location.href
      // in the context of unit tests.
      expect(location.href).toBe('http://localhost/');

      const url = getExploreUrl({
        formData,
        endpointType: 'base',
        force: false,
        curUrl: 'http://superset.com',
      });
      compareURI(URI(url), URI('/superset/explore/'));
    });
    it('generates proper json url', () => {
      const url = getExploreUrl({
        formData,
        endpointType: 'json',
        force: false,
        curUrl: 'http://superset.com',
      });
      compareURI(URI(url), URI('/superset/explore_json/'));
    });
    it('generates proper json forced url', () => {
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
    it('generates proper csv URL', () => {
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
    it('generates proper standalone URL', () => {
      const url = getExploreUrl({
        formData,
        endpointType: 'standalone',
        force: false,
        curUrl: 'superset.com',
      });
      compareURI(
        URI(url),
        URI('/superset/explore/').search({ standalone: 'true' }),
      );
    });
    it('preserves main URLs params', () => {
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
    it('generate proper save slice url', () => {
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

  describe('domain sharding', () => {
    let stub;
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

    it('generate url to different domains', () => {
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
    it('not generate url to different domains without flag', () => {
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

  describe('getExploreLongUrl', () => {
    it('generates proper base url with form_data', () => {
      compareURI(
        URI(getExploreLongUrl(formData, 'base')),
        URI('/superset/explore/').search({ form_data: sFormData }),
      );
    });
  });

  describe('buildV1ChartDataPayload', () => {
    it('generate valid request payload despite no registered buildQuery', () => {
      const v1RequestPayload = buildV1ChartDataPayload({
        formData: { ...formData, viz_type: 'my_custom_viz' },
      });
      expect(v1RequestPayload).hasOwnProperty('queries');
    });
  });

  describe('shouldUseLegacyApi', () => {
    beforeAll(() => {
      getChartMetadataRegistry()
        .registerValue('my_legacy_viz', { useLegacyApi: true })
        .registerValue('my_v1_viz', { useLegacyApi: false });
    });

    afterAll(() => {
      getChartMetadataRegistry().remove('my_legacy_viz').remove('my_v1_viz');
    });

    it('returns true for legacy viz', () => {
      const useLegacyApi = shouldUseLegacyApi({
        ...formData,
        viz_type: 'my_legacy_viz',
      });
      expect(useLegacyApi).toBe(true);
    });

    it('returns false for v1 viz', () => {
      const useLegacyApi = shouldUseLegacyApi({
        ...formData,
        viz_type: 'my_v1_viz',
      });
      expect(useLegacyApi).toBe(false);
    });

    it('returns false for formData with unregistered viz_type', () => {
      const useLegacyApi = shouldUseLegacyApi({
        ...formData,
        viz_type: 'undefined_viz',
      });
      expect(useLegacyApi).toBe(false);
    });

    it('returns false for formData without viz_type', () => {
      const useLegacyApi = shouldUseLegacyApi(formData);
      expect(useLegacyApi).toBe(false);
    });
  });

  describe('buildTimeRangeString', () => {
    it('generates proper time range string', () => {
      expect(
        buildTimeRangeString('2010-07-30T00:00:00', '2020-07-30T00:00:00'),
      ).toBe('2010-07-30T00:00:00 : 2020-07-30T00:00:00');
      expect(buildTimeRangeString('', '2020-07-30T00:00:00')).toBe(
        ' : 2020-07-30T00:00:00',
      );
      expect(buildTimeRangeString('', '')).toBe(' : ');
    });
  });

  describe('formatTimeRange', () => {
    it('generates a readable time range', () => {
      expect(formatTimeRange('Last 7 days')).toBe('Last 7 days');
      expect(formatTimeRange('No filter')).toBe('No filter');
      expect(formatTimeRange('Yesterday : Tomorrow')).toBe(
        'Yesterday < col < Tomorrow',
      );
      expect(
        formatTimeRange('2010-07-30T00:00:00 : 2020-07-30T00:00:00', [
          'inclusive',
          'exclusive',
        ]),
      ).toBe('2010-07-30 ≤ col < 2020-07-30');
      expect(
        formatTimeRange('2010-07-30T01:00:00 : ', ['exclusive', 'inclusive']),
      ).toBe('2010-07-30T01:00:00 < col ≤ ∞');
      expect(formatTimeRange(' : 2020-07-30T00:00:00')).toBe(
        '-∞ < col < 2020-07-30',
      );
    });
  });
});
