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

import { getMultipleTextDimensions, promiseTimeout } from '@superset-ui/core';
import { addDummyFill, removeDummyFill, SAMPLE_TEXT } from './getBBoxDummyFill';

describe('getMultipleTextDimension(input)', () => {
  describe('returns dimension of the given text', () => {
    beforeEach(addDummyFill);
    afterEach(removeDummyFill);

    it('takes an array of text as argument', () => {
      expect(
        getMultipleTextDimensions({
          texts: [SAMPLE_TEXT[0], SAMPLE_TEXT[1], ''],
        }),
      ).toEqual([
        {
          height: 20,
          width: 200,
        },
        {
          height: 20,
          width: 300,
        },
        {
          height: 0,
          width: 0,
        },
      ]);
    });
    it('handles empty text', () => {
      expect(
        getMultipleTextDimensions({
          texts: ['', ''],
        }),
      ).toEqual([
        {
          height: 0,
          width: 0,
        },
        {
          height: 0,
          width: 0,
        },
      ]);
    });
    it('handles duplicate text', () => {
      expect(
        getMultipleTextDimensions({
          texts: [SAMPLE_TEXT[0], SAMPLE_TEXT[0]],
        }),
      ).toEqual([
        {
          height: 20,
          width: 200,
        },
        {
          height: 20,
          width: 200,
        },
      ]);
    });
    it('accepts provided class via className', () => {
      expect(
        getMultipleTextDimensions({
          texts: [SAMPLE_TEXT[0], SAMPLE_TEXT[1]],
          className: 'test-class',
        }),
      ).toEqual([
        {
          height: 20,
          width: 100,
        },
        {
          height: 20,
          width: 150,
        },
      ]);
    });
    it('accepts provided style.font', () => {
      expect(
        getMultipleTextDimensions({
          texts: [SAMPLE_TEXT[0], SAMPLE_TEXT[1]],
          style: {
            font: 'italic 700 30px Lobster',
          },
        }),
      ).toEqual([
        {
          height: 30, // 20 * (30/20) [fontSize=30]
          width: 1125, // 200 * 1.25 [fontFamily=Lobster] * (30/20) [fontSize=30] * 1.5 [fontStyle=italic] * 2 [fontWeight=700]
        },
        {
          height: 30,
          width: 1688, // 300 * 1.25 [fontFamily=Lobster] * (30/20) [fontSize=30] * 1.5 [fontStyle=italic] * 2 [fontWeight=700]
        },
      ]);
    });
    it('accepts provided style.fontFamily', () => {
      expect(
        getMultipleTextDimensions({
          texts: [SAMPLE_TEXT[0], SAMPLE_TEXT[1]],
          style: {
            fontFamily: 'Lobster',
          },
        }),
      ).toEqual([
        {
          height: 20,
          width: 250, // 200 * 1.25 [fontFamily=Lobster]
        },
        {
          height: 20,
          width: 375, // 300 * 1.25 [fontFamily=Lobster]
        },
      ]);
    });
    it('accepts provided style.fontSize', () => {
      expect(
        getMultipleTextDimensions({
          texts: [SAMPLE_TEXT[0], SAMPLE_TEXT[1]],
          style: {
            fontSize: '40px',
          },
        }),
      ).toEqual([
        {
          height: 40, // 20 [baseHeight] * (40/20) [fontSize=40]
          width: 400, // 200 [baseWidth] * (40/20) [fontSize=40]
        },
        {
          height: 40,
          width: 600, // 300 [baseWidth] * (40/20) [fontSize=40]
        },
      ]);
    });
    it('accepts provided style.fontStyle', () => {
      expect(
        getMultipleTextDimensions({
          texts: [SAMPLE_TEXT[0], SAMPLE_TEXT[1]],
          style: {
            fontStyle: 'italic',
          },
        }),
      ).toEqual([
        {
          height: 20,
          width: 300, // 200 [baseWidth] * 1.5 [fontStyle=italic]
        },
        {
          height: 20,
          width: 450, // 300 [baseWidth] * 1.5 [fontStyle=italic]
        },
      ]);
    });
    it('accepts provided style.fontWeight', () => {
      expect(
        getMultipleTextDimensions({
          texts: [SAMPLE_TEXT[0], SAMPLE_TEXT[1]],
          style: {
            fontWeight: 700,
          },
        }),
      ).toEqual([
        {
          height: 20,
          width: 400, // 200 [baseWidth] * 2 [fontWeight=700]
        },
        {
          height: 20,
          width: 600, // 300 [baseWidth] * 2 [fontWeight=700]
        },
      ]);
    });
    it('accepts provided style.letterSpacing', () => {
      expect(
        getMultipleTextDimensions({
          texts: [SAMPLE_TEXT[0], SAMPLE_TEXT[1]],
          style: {
            letterSpacing: '1.1',
          },
        }),
      ).toEqual([
        {
          height: 20,
          width: 221, // Ceiling(200 [baseWidth] * 1.1 [letterSpacing=1.1])
        },
        {
          height: 20,
          width: 330, // Ceiling(300 [baseWidth] * 1.1 [letterSpacing=1.1])
        },
      ]);
    });
  });
  it('cleans up DOM', async () => {
    getMultipleTextDimensions({
      texts: [SAMPLE_TEXT[0], SAMPLE_TEXT[1]],
    });

    expect(document.querySelectorAll('svg')).toHaveLength(1);
    await promiseTimeout(() => {}, 501);
    expect(document.querySelector('svg')).toBeNull();
  });
});
