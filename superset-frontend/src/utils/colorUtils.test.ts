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

import { rgbStringToRgbaObject } from './colorUtils';

it('rgbStringToRgbaObject', () => {
  expect(rgbStringToRgbaObject('rgb(0,0,0)')).toEqual({
    r: 0,
    g: 0,
    b: 0,
    a: 1,
  });
  expect(rgbStringToRgbaObject('rgb(10,10,10)')).toEqual({
    r: 10,
    g: 10,
    b: 10,
    a: 1,
  });
  expect(rgbStringToRgbaObject('rgb(100,100,100)')).toEqual({
    r: 100,
    g: 100,
    b: 100,
    a: 1,
  });
  expect(rgbStringToRgbaObject('rgba(0,0,0,0.5)')).toEqual({
    r: 0,
    g: 0,
    b: 0,
    a: 0.5,
  });
  expect(rgbStringToRgbaObject('rgba(10,10,10,0.5)')).toEqual({
    r: 10,
    g: 10,
    b: 10,
    a: 0.5,
  });
  expect(rgbStringToRgbaObject('rgba(100,100,100,0.5)')).toEqual({
    r: 100,
    g: 100,
    b: 100,
    a: 0.5,
  });
  expect(rgbStringToRgbaObject('rgba(100, 100, 100, 0.5)')).toEqual({
    r: 100,
    g: 100,
    b: 100,
    a: 0.5,
  });
});
