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

import { themeObject } from '@superset-ui/core';
import tinycolor from 'tinycolor2';
import makeSingleton from '../utils/makeSingleton';
import ColorSchemeRegistry from './ColorSchemeRegistry';
import SequentialScheme from './SequentialScheme';
import schemes from './colorSchemes/sequential/d3';

function transformColor(color: string): string {
  const tc = tinycolor(color);
  if (!tc.isValid()) return color;

  const hsl = tc.toHsl();
  return tinycolor({
    h: hsl.h,
    s: hsl.s,
    l: 1 - hsl.l,
    a: hsl.a,
  }).toHexString();
}

function themeAwareColors(colors: string[]): string[] {
  if (!themeObject.isThemeDark()) {
    return colors.map(c => tinycolor(c).toHexString());
  }
  return colors.map(transformColor);
}

class SequentialSchemeRegistry extends ColorSchemeRegistry<SequentialScheme> {
  constructor() {
    super();
    schemes.forEach(s => this.registerValue(s.id, s));
    this.setDefaultKey('SUPERSET_DEFAULT');
  }

  override get(key: string): SequentialScheme {
    const base = super.get(key);
    if (!base) throw new Error(`Unknown sequential color scheme: ${key}`);

    return new SequentialScheme({
      ...base,
      colors: themeAwareColors(base.colors),
    });
  }
}

const getInstance = makeSingleton(SequentialSchemeRegistry);
export default getInstance;
