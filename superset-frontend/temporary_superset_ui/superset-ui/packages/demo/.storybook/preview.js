import { addParameters, addDecorator } from '@storybook/react';
import { jsxDecorator } from 'storybook-addon-jsx';

import 'bootstrap/dist/css/bootstrap.min.css';
import './storybook.css';

addDecorator(jsxDecorator);

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
      return a[1].kind === b[1].kind ? 0 : a[1].id.localeCompare(b[1].id, undefined, { numeric: true });
    },
  },
});
