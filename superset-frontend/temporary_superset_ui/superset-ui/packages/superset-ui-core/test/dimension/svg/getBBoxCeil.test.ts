/*
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

import getBBoxCeil from '@superset-ui/core/src/dimension/svg/getBBoxCeil';
import createTextNode from '@superset-ui/core/src/dimension/svg/createTextNode';

describe('getBBoxCeil(node, defaultDimension)', () => {
  describe('returns default dimension if getBBox() is not available', () => {
    it('returns default value for default dimension', () => {
      expect(getBBoxCeil(createTextNode())).toEqual({
        height: 20,
        width: 100,
      });
    });
    it('return specified value if specified', () => {
      expect(
        getBBoxCeil(createTextNode(), {
          height: 30,
          width: 400,
        }),
      ).toEqual({
        height: 30,
        width: 400,
      });
    });
  });
  describe('returns ceiling of the svg element', () => {
    it('converts to ceiling if value is not integer', () => {
      expect(
        getBBoxCeil(createTextNode(), { height: 10.6, width: 11.1 }),
      ).toEqual({
        height: 11,
        width: 12,
      });
    });

    it('does nothing if value is integer', () => {
      expect(getBBoxCeil(createTextNode())).toEqual({
        height: 20,
        width: 100,
      });
    });
  });
});
