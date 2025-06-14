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

import { isVersionBelow } from '../../src/util/serviceUtil';

describe('serviceUtil', () => {
  describe('isVersionBelow', () => {
    describe('WMS', () => {
      it('recognizes the higher version', () => {
        const result = isVersionBelow('1.3.0', '1.1.0', 'WMS');
        expect(result).toEqual(false);
      });
      it('recognizes the lower version', () => {
        const result = isVersionBelow('1.1.1', '1.3.0', 'WMS');
        expect(result).toEqual(true);
      });
    });

    describe('WFS', () => {
      it('recognizes the higher version', () => {
        const result = isVersionBelow('2.0.2', '1.1.0', 'WFS');
        expect(result).toEqual(false);
      });
      it('recognizes the lower version', () => {
        const result = isVersionBelow('1.1.0', '2.0.2', 'WFS');
        expect(result).toEqual(true);
      });
    });
  });
});
