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
import { getChartDataUri } from '.';

test('Get ChartUri when allowDomainSharding:false', () => {
  expect(
    getChartDataUri({
      path: '/path',
      qs: 'same-string',
      allowDomainSharding: false,
    }),
  ).toEqual({
    _deferred_build: true,
    _parts: {
      duplicateQueryParameters: false,
      escapeQuerySpace: true,
      fragment: null,
      hostname: 'localhost',
      password: null,
      path: '/path',
      port: '',
      preventInvalidHostname: false,
      protocol: 'http',
      query: 'same-string',
      urn: null,
      username: null,
    },
    _string: '',
  });
});

test('Get ChartUri when allowDomainSharding:true', () => {
  expect(
    getChartDataUri({
      path: '/path-allowDomainSharding-true',
      qs: 'same-string-allowDomainSharding-true',
      allowDomainSharding: true,
    }),
  ).toEqual({
    _deferred_build: true,
    _parts: {
      duplicateQueryParameters: false,
      escapeQuerySpace: true,
      fragment: null,
      hostname: undefined,
      password: null,
      path: '/path-allowDomainSharding-true',
      port: '',
      preventInvalidHostname: false,
      protocol: 'http',
      query: 'same-string-allowDomainSharding-true',
      urn: null,
      username: null,
    },
    _string: '',
  });
});
