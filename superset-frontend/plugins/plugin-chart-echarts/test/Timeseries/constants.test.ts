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
import { DEFAULT_FORM_DATA } from '../../src/Timeseries/constants';

describe('Timeseries constants', () => {
  describe('DEFAULT_FORM_DATA', () => {
    it('should include xAxisTimeFormat in default form data', () => {
      expect(DEFAULT_FORM_DATA).toHaveProperty('xAxisTimeFormat');
      expect(DEFAULT_FORM_DATA.xAxisTimeFormat).toBe('smart_date');
    });

    it('should include tooltipTimeFormat in default form data', () => {
      expect(DEFAULT_FORM_DATA).toHaveProperty('tooltipTimeFormat');
      expect(DEFAULT_FORM_DATA.tooltipTimeFormat).toBe('smart_date');
    });

    it('should have consistent time format defaults', () => {
      expect(DEFAULT_FORM_DATA.xAxisTimeFormat).toBe(
        DEFAULT_FORM_DATA.tooltipTimeFormat,
      );
    });

    it('should have vertical orientation as default', () => {
      expect(DEFAULT_FORM_DATA.orientation).toBe('vertical');
    });
  });
});
