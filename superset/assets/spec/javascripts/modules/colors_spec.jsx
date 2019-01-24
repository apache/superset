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
import { hexToRGB } from '../../../src/modules/colors';

describe('hexToRGB', () => {
  it('is a function', () => {
    expect(typeof hexToRGB).toBe('function');
  });

  it('hexToRGB converts properly', () => {
    expect(hexToRGB('#FFFFFF')).toEqual(expect.arrayContaining([255, 255, 255, 255]));
    expect(hexToRGB('#000000')).toEqual(expect.arrayContaining([0, 0, 0, 255]));
    expect(hexToRGB('#FF0000')).toEqual(expect.arrayContaining([255, 0, 0, 255]));
    expect(hexToRGB('#00FF00')).toEqual(expect.arrayContaining([0, 255, 0, 255]));
    expect(hexToRGB('#0000FF')).toEqual(expect.arrayContaining([0, 0, 255, 255]));
  });

  it('works with falsy values', () => {
    expect(hexToRGB()).toEqual([0, 0, 0, 255]);
    /* eslint-disable quotes */
    [false, 0, -0, 0.0, '', "", ``, null, undefined, NaN].forEach((value) => {
      expect(hexToRGB(value)).toEqual(expect.arrayContaining([0, 0, 0, 255]));
    });
  });

  it('takes and alpha argument', () => {
    expect(hexToRGB('#FF0000', 128)).toEqual(expect.arrayContaining([255, 0, 0, 128]));
    expect(hexToRGB('#000000', 100)).toEqual(expect.arrayContaining([0, 0, 0, 100]));
    expect(hexToRGB('#ffffff', 0)).toEqual(expect.arrayContaining([255, 255, 255, 0]));
  });
});
