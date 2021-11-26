import { addParameters, addDecorator } from '@storybook/react';
import { jsxDecorator } from 'storybook-addon-jsx';
import categoricalD3 from '@superset-ui/core/lib/color/colorSchemes/categorical/d3';
import sequentialCommon from '@superset-ui/core/lib/color/colorSchemes/sequential/common';
import sequentialD3 from '@superset-ui/core/lib/color/colorSchemes/sequential/d3';
import {
  configure,
  getTimeFormatterRegistry,
  smartDateFormatter,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
} from '@superset-ui/core';
import { configureEncodable } from '@superset-ui/preset-chart-xy';
import themeDecorator from './themeDecorator';

import 'bootstrap/dist/css/bootstrap.min.css';
import './storybook.css';

addDecorator(jsxDecorator);
addDecorator(themeDecorator);

addParameters({
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
      if (a[1].kind === b[1].kind) {
        return 0;
      }
      if (a[1].id.startsWith('core-packages') && !b[1].id.startsWith('core-packages')) {
        return -1;
      }
      if (!a[1].id.startsWith('core-packages') && b[1].id.startsWith('core-packages')) {
        return 1;
      }
      return a[1].id.localeCompare(b[1].id, undefined, { numeric: true });
    },
  },
});

// Superset setup

configure();

// Register color schemes
const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
[categoricalD3].forEach(group => {
  group.forEach(scheme => {
    categoricalSchemeRegistry.registerValue(scheme.id, scheme);
  });
});
categoricalSchemeRegistry.setDefaultKey('d3Category10');

const sequentialSchemeRegistry = getSequentialSchemeRegistry();
[sequentialCommon, sequentialD3].forEach(group => {
  group.forEach(scheme => {
    sequentialSchemeRegistry.registerValue(scheme.id, scheme);
  });
});

getTimeFormatterRegistry()
  .registerValue('smart_date', smartDateFormatter)
  .setDefaultKey('smart_date');

configureEncodable();
