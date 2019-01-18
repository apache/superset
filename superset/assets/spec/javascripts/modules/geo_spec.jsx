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
import { unitToRadius } from '../../../src/modules/geo';

const METER_TO_MILE = 1609.34;

describe('unitToRadius', () => {
  it('converts to square meters', () => {
    expect(unitToRadius('square_m', 4 * Math.PI)).toBe(2);
  });
  it('converts to square kilometers', () => {
    expect(unitToRadius('square_km', 25 * Math.PI)).toBe(5000);
  });
  it('converts to radius meters', () => {
    expect(unitToRadius('radius_m', 1000)).toBe(1000);
  });
  it('converts to radius km', () => {
    expect(unitToRadius('radius_km', 1)).toBe(1000);
  });
  it('converts to radius miles', () => {
    expect(unitToRadius('radius_miles', 1)).toBe(METER_TO_MILE);
  });
  it('converts to square miles', () => {
    expect(unitToRadius('square_miles', 25 * Math.PI)).toBe(5000 * (METER_TO_MILE / 1000));
  });
});
