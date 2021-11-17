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

let originalFn: () => DOMRect;

const textToWidth = {
  paris: 200,
  tokyo: 300,
  beijing: 400,
};

export const SAMPLE_TEXT = Object.keys(textToWidth);

export function addDummyFill() {
  // @ts-ignore - fix jsdom
  originalFn = SVGElement.prototype.getBBox;

  // @ts-ignore - fix jsdom
  SVGElement.prototype.getBBox = function getBBox() {
    let width =
      textToWidth[this.textContent as keyof typeof textToWidth] || 200;
    let height = 20;

    if (this.getAttribute('class') === 'test-class') {
      width /= 2;
    }

    if (this.style.fontFamily === 'Lobster') {
      width *= 1.25;
    }

    if (this.style.fontSize) {
      const size = Number(this.style.fontSize.replace('px', ''));
      const ratio = size / 20;
      width *= ratio;
      height *= ratio;
    }

    if (this.style.fontStyle === 'italic') {
      width *= 1.5;
    }

    if (this.style.fontWeight === '700') {
      width *= 2;
    }

    if (this.style.letterSpacing) {
      width *= 1.1;
    }

    return {
      x: 0,
      y: 0,
      width,
      height,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    };
  };
}

export function removeDummyFill() {
  // @ts-ignore - fix jsdom
  SVGElement.prototype.getBBox = originalFn;
}
