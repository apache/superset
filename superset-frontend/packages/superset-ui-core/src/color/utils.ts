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

const rgbRegex = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/;
export function getContrastingColor(color: string, thresholds = 186) {
  let r = 0;
  let g = 0;
  let b = 0;
  if (color.length > 7) {
    // rgb
    const matchColor = rgbRegex.exec(color);
    if (!matchColor) {
      throw new Error(`Invalid color: ${color}`);
    }
    r = parseInt(matchColor[1], 10);
    g = parseInt(matchColor[2], 10);
    b = parseInt(matchColor[3], 10);
  } else {
    // hex
    let hex = color;
    if (hex.startsWith('#')) {
      hex = hex.substring(1);
    }
    // #FFF
    if (hex.length === 3) {
      hex = [hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]].join('');
    }
    if (hex.length !== 6) {
      throw new Error(`Invalid color: ${color}`);
    }
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }

  return r * 0.299 + g * 0.587 + b * 0.114 > thresholds ? '#000' : '#FFF';
}
