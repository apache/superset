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
import { withJsx } from '@mihkeleidast/storybook-addon-source';
import { themeObject, css, exampleThemes } from '@superset-ui/core';
import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import reducerIndex from 'spec/helpers/reducerIndex';
import { Global } from '@emotion/react';
import { App, Layout, Space, Content } from 'antd';

import 'src/theme.ts';
import './storybook.css';

export const GlobalStylesOverrides = () => (
  <Global
    styles={css`
      html,
      body,
      #storybook-root {
        margin: 0 !important;
        padding: 0 !important;
        min-height: 100vh !important;
      }

      .ant-app {
        min-height: 100vh !important;
      }
    `}
  />
);

const store = createStore(
  combineReducers(reducerIndex),
  {},
  compose(applyMiddleware(thunk)),
);

export const globalTypes = {
  theme: {
    name: 'Theme',
    description: 'Global theme for components',
    defaultValue: 'superset',
    toolbar: {
      icon: 'paintbrush',
      items: Object.keys(exampleThemes),
    },
  },
};

const themeDecorator = (Story, context) => {
  const themeKey = context.globals.theme || 'superset';
  themeObject.setConfig(exampleThemes[themeKey]);

  return (
    <themeObject.SupersetThemeProvider>
      <App>
        <GlobalStylesOverrides />
        <Layout
          style={{
            minHeight: '100vh',
            width: '100%',
            padding: 24,
            backgroundColor: themeObject.theme.colorBgBase,
          }}
        >
          <Story {...context} />
        </Layout>
      </App>
    </themeObject.SupersetThemeProvider>
  );
};

const providerDecorator = Story => (
  <Provider store={store}>
    <Story />
  </Provider>
);

export const decorators = [withJsx, themeDecorator, providerDecorator];

export const parameters = {
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
  controls: { expanded: true, sort: 'alpha', disableSaveFromUI: true },
};
