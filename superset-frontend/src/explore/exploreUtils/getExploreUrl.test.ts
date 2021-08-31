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
import { getExploreUrl } from '.';

const createParams = () => ({
  formData: {
    datasource: 'datasource',
    viz_type: 'viz_type',
  },
  endpointType: 'base',
  force: false,
  curUrl: null,
  requestParams: {},
  allowDomainSharding: false,
  method: 'POST',
});

test('Get ExploreUrl with default params', () => {
  const params = createParams();
  expect(getExploreUrl(params)).toBe('http://localhost/superset/explore/');
});

test('Get ExploreUrl with endpointType:full', () => {
  const params = createParams();
  expect(getExploreUrl({ ...params, endpointType: 'full' })).toBe(
    'http://localhost/superset/explore_json/',
  );
});

test('Get ExploreUrl with endpointType:full and method:GET', () => {
  const params = createParams();
  expect(
    getExploreUrl({ ...params, endpointType: 'full', method: 'GET' }),
  ).toBe('http://localhost/superset/explore_json/');
});
