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
import WithPaddings from 'storybook-addon-paddings';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import reducerIndex from 'spec/helpers/reducerIndex';
import { GlobalStyles } from '../src/GlobalStyles';

import 'src/theme.ts';
import './storybook.css';

const store = createStore(
  combineReducers(reducerIndex),
  {},
  compose(applyMiddleware(thunk)),
);

const themeDecorator = Story => (
  <ThemeProvider theme={supersetTheme}>
    <>
      <GlobalStyles />
      <Story />
    </>
  </ThemeProvider>
);

const providerDecorator = Story => (
  <Provider store={store}>
    <Story />
  </Provider>
);

addDecorator(jsxDecorator);
addDecorator(themeDecorator);
addDecorator(providerDecorator);
addDecorator(WithPaddings);

addParameters({
  paddings: {
    values: [
      { name: 'None', value: '0px' },
      { name: 'Small', value: '16px' },
      { name: 'Medium', value: '32px' },
      { name: 'Large', value: '64px' },
    ],
    default: 'Medium',
  },
  options: {
    storySort: {
      order: [
        'Superset Frontend',
        ['Controls', 'Display', 'Feedback', 'Input', '*'],
        ['Overview', 'Examples', '*'],
        'Design System',
        [
          'Introduction',
          'Foundations',
          'Components',
          ['Overview', 'Examples', '*'],
          'Patterns',
          '*',
        ],
        ['Overview', 'Examples', '*'],
        '*',
      ],
    },
  },
  controls: { expanded: true, sort: 'alpha' },
});
