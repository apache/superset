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
import { HierarchyRectangularNode } from 'd3-hierarchy';
import { IcicleEventNode } from '../IcicleEventNode';

export function x0(isVertical: boolean, d: HierarchyRectangularNode<IcicleEventNode>) {
  return isVertical ? d.y0 : d.x0;
}

export function x1(isVertical: boolean, d: HierarchyRectangularNode<IcicleEventNode>) {
  return isVertical ? d.y1 : d.x1;
}

export function y0(isVertical: boolean, d: HierarchyRectangularNode<IcicleEventNode>) {
  return isVertical ? d.x0 : d.y0;
}

export function y1(isVertical: boolean, d: HierarchyRectangularNode<IcicleEventNode>) {
  return isVertical ? d.x1 : d.y1;
}

export function rectWidth(
  isVertical: boolean,
  boxMargin: { x: number; y: number },
  d: HierarchyRectangularNode<IcicleEventNode>,
) {
  return Math.max(0, y1(isVertical, d) - y0(isVertical, d) - boxMargin.y * 2);
}

export function rectHeight(
  isVertical: boolean,
  boxMargin: { x: number; y: number },
  d: HierarchyRectangularNode<IcicleEventNode>,
) {
  return Math.max(
    0,
    x1(isVertical, d) -
      x0(isVertical, d) -
      (Math.min(1, (x1(isVertical, d) - x0(isVertical, d)) / 2) + boxMargin.x * 2),
  );
}
