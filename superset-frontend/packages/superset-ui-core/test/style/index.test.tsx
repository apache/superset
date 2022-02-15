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

import React from 'react';
import { mount } from 'enzyme';
import {
  styled,
  supersetTheme,
  SupersetThemeProps,
  useTheme,
  ThemeProvider,
  EmotionCacheProvider,
  emotionCache,
} from '@superset-ui/core';

describe('@superset-ui/style package', () => {
  it('exports a theme', () => {
    expect(typeof supersetTheme).toBe('object');
  });

  it('exports styled component templater', () => {
    expect(typeof styled.div).toBe('function');
  });

  it('exports SupersetThemeProps', () => {
    const props: SupersetThemeProps = {
      theme: supersetTheme,
    };
    expect(typeof props).toBe('object');
  });

  describe('useTheme()', () => {
    it('returns the theme', () => {
      function ThemeUser() {
        expect(useTheme()).toStrictEqual(supersetTheme);
        return <div>test</div>;
      }
      mount(<ThemeUser />, {
        wrappingComponent: ({ children }) => (
          <EmotionCacheProvider value={emotionCache}>
            <ThemeProvider theme={supersetTheme}>{children}</ThemeProvider>
          </EmotionCacheProvider>
        ),
      });
    });

    it('throws when a theme is not present', () => {
      function ThemeUser() {
        expect(useTheme).toThrow(/could not find a ThemeContext/);
        return <div>test</div>;
      }
      mount(<ThemeUser />, {
        wrappingComponent: ({ children }) => <div>{children}</div>,
      });
    });
  });
});
