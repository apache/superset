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
import { withJsx } from '@mihkeleidast/storybook-addon-source';
import {
  configure,
  getTimeFormatterRegistry,
  smartDateFormatter,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  CategoricalD3,
  CategoricalSuperset,
  SequentialCommon,
  SequentialD3,
} from '@superset-ui/core';
import themeDecorator from './themeDecorator';

import './storybook.css';

export const decorators = [withJsx, themeDecorator];

export const parameters = {
  passArgsFirst: false,
  options: {
    name: '✨ Superset UI',
    addonPanelInRight: false,
    enableShortcuts: false,
    goFullScreen: false,
    hierarchyRootSeparator: null,
    hierarchySeparator: /\|/,
    selectedAddonPanel: undefined, // The order of addons in the "Addon panel" is the same as you import them in 'addons.js'. The first panel will be opened by default as you run Storybook
    showAddonPanel: true,
    showSearchBox: false,
    showStoriesPanel: true,
    sidebarAnimations: true,
    sortStoriesByKind: false,
    url: '#',
    storySort: (a, b) => {
      if (a.kind === b.kind) {
        return 0;
      }
      if (
        a.id.startsWith('core-packages') &&
        !b.id.startsWith('core-packages')
      ) {
        return -1;
      }
      if (
        !a.id.startsWith('core-packages') &&
        b.id.startsWith('core-packages')
      ) {
        return 1;
      }
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    },
  },
};

// Superset setup
configure();

// Register color schemes
const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
[CategoricalD3, CategoricalSuperset].forEach(group => {
  group.forEach(scheme => {
    categoricalSchemeRegistry.registerValue(scheme.id, scheme);
  });
});
categoricalSchemeRegistry.setDefaultKey('d3Category10');

const sequentialSchemeRegistry = getSequentialSchemeRegistry();
[SequentialCommon, SequentialD3].forEach(group => {
  group.forEach(scheme => {
    sequentialSchemeRegistry.registerValue(scheme.id, scheme);
  });
});

getTimeFormatterRegistry()
  .registerValue('smart_date', smartDateFormatter)
  .setDefaultKey('smart_date');
