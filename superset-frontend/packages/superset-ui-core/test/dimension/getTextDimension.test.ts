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

import { promiseTimeout, getTextDimension } from '@superset-ui/core/src';
import { addDummyFill, removeDummyFill, SAMPLE_TEXT } from './getBBoxDummyFill';

describe('getTextDimension(input)', () => {
  describe('returns default dimension if getBBox() is not available', () => {
    it('returns default value for default dimension', () => {
      expect(
        getTextDimension({
          text: SAMPLE_TEXT[0],
        }),
      ).toEqual({
        height: 20,
        width: 100,
      });
    });
    it('return specified value if specified', () => {
      expect(
        getTextDimension(
          {
            text: SAMPLE_TEXT[0],
          },
          {
            height: 30,
            width: 400,
          },
        ),
      ).toEqual({
        height: 30,
        width: 400,
      });
    });
  });
  describe('returns dimension of the given text', () => {
    beforeEach(addDummyFill);
    afterEach(removeDummyFill);

    it('takes text as argument', () => {
      expect(
        getTextDimension({
          text: SAMPLE_TEXT[0],
        }),
      ).toEqual({
        height: 20,
        width: 200,
      });
    });
    it('accepts provided class via className', () => {
      expect(
        getTextDimension({
          text: SAMPLE_TEXT[0],
          className: 'test-class',
        }),
      ).toEqual({
        height: 20,
        width: 100, // width is 100 after adding class
      });
    });
    it('accepts provided style.font', () => {
      expect(
        getTextDimension({
          text: SAMPLE_TEXT[0],
          style: {
            font: 'italic 700 30px Lobster',
          },
        }),
      ).toEqual({
        height: 30, // 20 * (30/20) [fontSize=30]
        width: 1125, // 250 [fontFamily=Lobster] * (30/20) [fontSize=30] * 1.5 [fontStyle=italic] * 2 [fontWeight=700]
      });
    });
    it('accepts provided style.fontFamily', () => {
      expect(
        getTextDimension({
          text: SAMPLE_TEXT[0],
          style: {
            fontFamily: 'Lobster',
          },
        }),
      ).toEqual({
        height: 20,
        width: 250, // (250 [fontFamily=Lobster]
      });
    });
    it('accepts provided style.fontSize', () => {
      expect(
        getTextDimension({
          text: SAMPLE_TEXT[0],
          style: {
            fontSize: '40px',
          },
        }),
      ).toEqual({
        height: 40, // 20 [baseHeight] * (40/20) [fontSize=40]
        width: 400, // 200 [baseWidth] * (40/20) [fontSize=40]
      });
    });
    it('accepts provided style.fontStyle', () => {
      expect(
        getTextDimension({
          text: SAMPLE_TEXT[0],
          style: {
            fontStyle: 'italic',
          },
        }),
      ).toEqual({
        height: 20,
        width: 300, // 200 [baseWidth] * 1.5 [fontStyle=italic]
      });
    });
    it('accepts provided style.fontWeight', () => {
      expect(
        getTextDimension({
          text: SAMPLE_TEXT[0],
          style: {
            fontWeight: 700,
          },
        }),
      ).toEqual({
        height: 20,
        width: 400, // 200 [baseWidth] * 2 [fontWeight=700]
      });
    });
    it('accepts provided style.letterSpacing', () => {
      expect(
        getTextDimension({
          text: SAMPLE_TEXT[0],
          style: {
            letterSpacing: '1.1',
          },
        }),
      ).toEqual({
        height: 20,
        width: 221, // Ceiling(200 [baseWidth] * 1.1 [letterSpacing=1.1])
      });
    });
    it('handle empty text', () => {
      expect(
        getTextDimension({
          text: '',
        }),
      ).toEqual({
        height: 0,
        width: 0,
      });
    });
  });
  it('cleans up DOM', async () => {
    getTextDimension({
      text: SAMPLE_TEXT[0],
    });

    expect(document.querySelectorAll('svg')).toHaveLength(1);
    await promiseTimeout(() => {}, 501);
    expect(document.querySelector('svg')).toBeNull();
  });
});
