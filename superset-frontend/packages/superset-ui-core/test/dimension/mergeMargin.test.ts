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

import { mergeMargin } from '@superset-ui/core';

describe('mergeMargin(margin1, margin2, mode?)', () => {
  it('combines two given margin', () => {
    expect(
      mergeMargin(
        {
          top: 1,
          left: 1,
          bottom: 2,
          right: 2,
        },
        {
          top: 2,
          left: 2,
          bottom: 1,
          right: 1,
        },
      ),
    ).toEqual({
      top: 2,
      left: 2,
      bottom: 2,
      right: 2,
    });
  });
  describe('default values', () => {
    it('works if margin1 is not defined', () => {
      expect(
        mergeMargin(undefined, {
          top: 2,
          left: 2,
          bottom: 1,
          right: 1,
        }),
      ).toEqual({
        top: 2,
        left: 2,
        bottom: 1,
        right: 1,
      });
    });
    it('works if margin2 is not defined', () => {
      expect(
        mergeMargin(
          {
            top: 1,
            left: 1,
            bottom: 2,
            right: 2,
          },
          undefined,
        ),
      ).toEqual({
        top: 1,
        left: 1,
        bottom: 2,
        right: 2,
      });
    });
    it('use 0 for the side that is not specified', () => {
      expect(mergeMargin({}, {})).toEqual({
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
      });
    });
  });
  describe('mode', () => {
    it('if mode=expand, returns the larger margin for each side', () => {
      expect(
        mergeMargin(
          {
            top: 1,
            left: 1,
            bottom: 2,
            right: 2,
          },
          {
            top: 2,
            left: 2,
            bottom: 1,
            right: 1,
          },
          'expand',
        ),
      ).toEqual({
        top: 2,
        left: 2,
        bottom: 2,
        right: 2,
      });
    });
    it('if mode=shrink, returns the smaller margin for each side', () => {
      expect(
        mergeMargin(
          {
            top: 1,
            left: 1,
            bottom: 2,
            right: 2,
          },
          {
            top: 2,
            left: 2,
            bottom: 1,
            right: 1,
          },
          'shrink',
        ),
      ).toEqual({
        top: 1,
        left: 1,
        bottom: 1,
        right: 1,
      });
    });
    it('expand by default', () => {
      expect(
        mergeMargin(
          {
            top: 1,
            left: 1,
            bottom: 2,
            right: 2,
          },
          {
            top: 2,
            left: 2,
            bottom: 1,
            right: 1,
          },
        ),
      ).toEqual({
        top: 2,
        left: 2,
        bottom: 2,
        right: 2,
      });
    });
  });
  it('works correctly for negative margins', () => {
    expect(
      mergeMargin(
        {
          top: -3,
          left: -3,
          bottom: -2,
          right: -2,
        },
        {
          top: -2,
          left: -2,
          bottom: 0,
          right: -1,
        },
      ),
    ).toEqual({
      top: -2,
      left: -2,
      bottom: 0,
      right: -1,
    });
  });
  it('if there are NaN or null, use another value', () => {
    expect(
      mergeMargin(
        {
          top: 10,
          // @ts-ignore to let us pass `null` for testing
          left: null,
          bottom: 20,
          right: NaN,
        },
        {
          top: NaN,
          left: 30,
          bottom: null,
          right: 40,
        },
      ),
    ).toEqual({
      top: 10,
      left: 30,
      bottom: 20,
      right: 40,
    });
  });
});
