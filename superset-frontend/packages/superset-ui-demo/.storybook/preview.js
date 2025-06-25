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

import 'bootstrap/dist/css/bootstrap.min.css';
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
