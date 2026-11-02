/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with work for additional information
 * regarding copyright ownership.  The ASF licenses file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use file except in compliance
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

import { getLayer } from './Contour';

jest.mock('../../factory', () => ({ createDeckGLComponent: jest.fn() }));
jest.mock('../common', () => ({ commonLayerProps: () => ({}) }));

test.each([
  [-1, 0],
  [0, 1],
  [1, 2],
  [0, undefined],
  [0, NaN],
])(
  'renders thresholds %s and %s in the correct contour shape',
  (lowerThreshold, upperThreshold) => {
    const layer = getLayer({
      formData: {
        datasource: '1__table',
        viz_type: 'deck_contour',
        contours: [
          {
            lowerThreshold,
            upperThreshold,
            color: { r: 30, g: 120, b: 200 },
            strokeWidth: 2,
          },
        ],
      },
      payload: { data: { features: [] } },
      setTooltip: jest.fn(),
    });
    expect(layer.props.contours?.[0].threshold).toEqual(
      upperThreshold === undefined || Number.isNaN(upperThreshold)
        ? lowerThreshold
        : [lowerThreshold, upperThreshold],
    );
  },
);
