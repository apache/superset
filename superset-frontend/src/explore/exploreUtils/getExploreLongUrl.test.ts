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
import { getExploreLongUrl } from '.';

const createParams = () => ({
  formData: {
    datasource: 'datasource',
    viz_type: 'viz_type',
  },
  endpointType: 'endpointType',
  allowOverflow: true,
  extraSearch: { same: 'any-string' },
});

test('Should return null if formData.datasource is falsy', () => {
  const params = createParams();
  expect(
    getExploreLongUrl(
      {},
      params.endpointType,
      params.allowOverflow,
      params.extraSearch,
    ),
  ).toBeNull();
});

test('Get url when endpointType:standalone', () => {
  const params = createParams();
  expect(
    getExploreLongUrl(
      params.formData,
      params.endpointType,
      params.allowOverflow,
      params.extraSearch,
    ),
  ).toBe(
    '/superset/explore/?same=any-string&form_data=%7B%22datasource%22%3A%22datasource%22%2C%22viz_type%22%3A%22viz_type%22%7D',
  );
});

test('Get url when endpointType:standalone and allowOverflow:false', () => {
  const params = createParams();
  expect(
    getExploreLongUrl(
      params.formData,
      params.endpointType,
      false,
      params.extraSearch,
    ),
  ).toBe(
    '/superset/explore/?same=any-string&form_data=%7B%22datasource%22%3A%22datasource%22%2C%22viz_type%22%3A%22viz_type%22%7D',
  );
});

test('Get url when endpointType:results', () => {
  const params = createParams();
  expect(
    getExploreLongUrl(
      params.formData,
      'results',
      params.allowOverflow,
      params.extraSearch,
    ),
  ).toBe(
    '/superset/explore_json/?same=any-string&form_data=%7B%22datasource%22%3A%22datasource%22%2C%22viz_type%22%3A%22viz_type%22%7D',
  );
});

test('Get url when endpointType:results and allowOverflow:false', () => {
  const params = createParams();
  expect(
    getExploreLongUrl(params.formData, 'results', false, params.extraSearch),
  ).toBe(
    '/superset/explore_json/?same=any-string&form_data=%7B%22datasource%22%3A%22datasource%22%2C%22viz_type%22%3A%22viz_type%22%7D',
  );
});

test('Get url from a dashboard', () => {
  const formData = {
    ...createParams().formData,
    // these params should get filtered out
    extra_form_data: {
      filters: {
        col: 'foo',
        op: 'IN',
        val: ['bar'],
      },
    },
    dataMask: {
      'NATIVE_FILTER-bqEoUsEPe': {
        id: 'NATIVE_FILTER-bqEoUsEPe',
        lots: 'of other stuff here too',
      },
    },
  };
  expect(getExploreLongUrl(formData, null, false)).toBe(
    '/superset/explore/?form_data=%7B%22datasource%22%3A%22datasource%22%2C%22viz_type%22%3A%22viz_type%22%2C%22extra_form_data%22%3A%7B%22filters%22%3A%7B%22col%22%3A%22foo%22%2C%22op%22%3A%22IN%22%2C%22val%22%3A%5B%22bar%22%5D%7D%7D%7D',
  );
});
