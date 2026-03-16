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
import { extent as d3Extent } from 'd3-array';
import { Point, Range } from '../types';

const LAT_LIMIT: Range = [-90, 90];
const LNG_LIMIT: Range = [-180, 180];

/**
 * Expand a coordinate range by `padding` and within limits, if needed
 */
function expandIfNeeded(
  [curMin, curMax]: Range,
  [minBound, maxBound]: Range,
  padding = 0.25,
) {
  return curMin < curMax
    ? [curMin, curMax]
    : [
        Math.max(minBound, curMin - padding),
        Math.min(maxBound, curMax + padding),
      ];
}

export default function computeBoundsFromPoints(
  points: Point[],
): [Point, Point] {
  const latBounds = expandIfNeeded(
    d3Extent(points, (x: Point) => x[1]) as Range,
    LAT_LIMIT,
  );
  const lngBounds = expandIfNeeded(
    d3Extent(points, (x: Point) => x[0]) as Range,
    LNG_LIMIT,
  );
  return [
    [lngBounds[0], latBounds[0]],
    [lngBounds[1], latBounds[1]],
  ];
}
