import { addDecorator } from '@storybook/react';
import { withOptions } from '@storybook/addon-options';

addDecorator(
  withOptions({
    addonPanelInRight: false,
    enableShortcuts: false,
    goFullScreen: false,
    hierarchySeparator: /\|/,
    // hierarchyRootSeparator: null,
    name: '@superset-ui/plugins 🔌💡',
    selectedAddonPanel: undefined, // The order of addons in the "Addon panel" is the same as you import them in 'addons.js'. The first panel will be opened by default as you run Storybook
    showAddonPanel: true,
    showSearchBox: false,
    showStoriesPanel: true,
    sidebarAnimations: true,
    sortStoriesByKind: false,
    url: '#',
  }),
);
