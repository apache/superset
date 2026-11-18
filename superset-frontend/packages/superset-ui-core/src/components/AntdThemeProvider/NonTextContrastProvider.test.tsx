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
import { render, screen } from '@superset-ui/core/spec';
import { AntdThemeProvider } from '.';
import { Checkbox } from '../Checkbox';
import { Input } from '../Input';
import { Switch } from '../Switch';

const primaryColors = (testId: string) =>
  new Set(
    Array.from(
      screen.getByTestId(testId).querySelectorAll('[class*="-css-var"]'),
    ).map(el =>
      getComputedStyle(el)
        .getPropertyValue('--ant-color-primary')
        .toLowerCase(),
    ),
  );

test('controls under differently themed providers keep their own theme tokens', () => {
  render(
    <>
      <AntdThemeProvider theme={{ token: { colorPrimary: '#ff0000' } }}>
        <div data-test="red-theme">
          <Input />
          <Checkbox />
          <Switch />
        </div>
      </AntdThemeProvider>
      <AntdThemeProvider theme={{ token: { colorPrimary: '#00ff00' } }}>
        <div data-test="green-theme">
          <Input />
          <Checkbox />
          <Switch />
        </div>
      </AntdThemeProvider>
    </>,
  );

  expect(primaryColors('red-theme')).toEqual(new Set(['#ff0000']));
  expect(primaryColors('green-theme')).toEqual(new Set(['#00ff00']));
});
