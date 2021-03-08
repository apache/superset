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
type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getLabelFontSize(width: number): number {
  if (width > 550) {
    return 0.8;
  }

  if (width > 400 && width <= 550) {
    return 0.55;
  }

  return 0.45;
}

export const isOverlapping = (rect1: Rect, rect2: Rect): boolean => {
  const { x: x1, y: y1, width: width1, height: height1 } = rect1;
  const { x: x2, y: y2, width: width2, height: height2 } = rect2;

  return !(x1 > x2 + width2 || x1 + width1 < x2 || y1 > y2 + height2 || y1 + height1 < y2);
};

export const getRectangle = (element: SVGElement, offset = 0): Rect => {
  const { x, y, width, height } = element.getBoundingClientRect();

  return {
    x,
    y: y + offset,
    width,
    height: height - offset * 2,
  };
};

export const getOverlappingElements = (elements: SVGElement[]): SVGElement[] => {
  const overlappingElements: SVGElement[] = [];

  elements.forEach((e1, index1) => {
    const rect1: Rect = getRectangle(e1, 1);

    elements.forEach((e2, index2) => {
      if (index2 <= index1) return;
      const rect2: Rect = getRectangle(e2, 1);

      if (isOverlapping(rect1, rect2)) {
        overlappingElements.push(elements[index2]);
        overlappingElements.push(elements[index1]);
      }
    });
  });

  return overlappingElements;
};
