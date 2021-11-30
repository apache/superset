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

import { getOverlappingElements, isOverlapping } from '../utils';

const overlapRects = [
  {
    x: 10,
    y: 10,
    width: 10,
    height: 10,
  },
  {
    x: 12,
    y: 12,
    width: 12,
    height: 12,
  },
  {
    x: 32,
    y: 32,
    width: 32,
    height: 32,
  },
];

const notOverlapRects = [
  {
    x: 10,
    y: 10,
    width: 10,
    height: 10,
  },
  {
    x: 24,
    y: 15,
    width: 15,
    height: 15,
  },
  {
    x: 32,
    y: 32,
    width: 32,
    height: 32,
  },
];

const createSVGs = objects =>
  objects.map(data => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.getBoundingClientRect = jest.fn(() => data);

    return el;
  });

// https://www.khanacademy.org/computer-programming/rectx-y-width-height-radius/839496660
describe('legacy-plugin-chart-sankey/utils', () => {
  it('isOverlapping to be truthy', () => {
    const [rect1, rect2] = overlapRects;
    expect(isOverlapping(rect1, rect2)).toBeTruthy();
  });

  it('isOverlapping to be falsy', () => {
    const [rect1, rect2] = notOverlapRects;
    expect(isOverlapping(rect1, rect2)).toBeFalsy();
  });

  it('getOverlappingElements to be truthy', () => {
    const elements = createSVGs(overlapRects);
    expect(getOverlappingElements(elements).length).toBe(2);
  });

  it('getOverlappingElements to be falsy', () => {
    const elements = createSVGs(notOverlapRects);
    expect(getOverlappingElements(elements).length).toBe(0);
  });
});
