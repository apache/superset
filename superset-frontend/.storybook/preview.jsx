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
import React from 'react';
import { addDecorator } from '@storybook/react';
import { jsxDecorator } from 'storybook-addon-jsx';
import { addParameters } from '@storybook/react';
import { withPaddings } from 'storybook-addon-paddings';

import { supersetTheme, ThemeProvider } from '@superset-ui/core';

import '../src/theme.ts';
import './storybook.css';

const themeDecorator = storyFn => (
  <ThemeProvider theme={supersetTheme}>{storyFn()}</ThemeProvider>
);

addDecorator(jsxDecorator);
addDecorator(themeDecorator);
addDecorator(withPaddings);

addParameters({
  paddings: [
    { name: 'None', value: '0px' },
    { name: 'Small', value: '16px' },
    { name: 'Medium', value: '32px', default: true },
    { name: 'Large', value: '64px' },
  ],
});
