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
import { validateMapboxStylesUrl } from '@superset-ui/core';
import './setup';

describe('validateMapboxStylesUrl', () => {
  it('should validate mapbox style URLs', () => {
    expect(
      validateMapboxStylesUrl('mapbox://styles/mapbox/streets-v9'),
    ).toEqual(false);
    expect(
      validateMapboxStylesUrl(
        'mapbox://styles/foobar/clp2dr5r4008a01pcg4ad45m8',
      ),
    ).toEqual(false);
  });

  [
    123,
    ['mapbox://styles/mapbox/streets-v9'],
    { url: 'mapbox://styles/mapbox/streets-v9' },
    'https://superset.apache.org/',
    'mapbox://tileset/mapbox/streets-v9',
  ].forEach(value => {
    it(`should not validate ${value}`, () => {
      expect(validateMapboxStylesUrl(value)).toEqual(
        'is expected to be a Mapbox URL',
      );
    });
  });
});
