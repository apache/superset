import { addParameters, configure } from '@storybook/react';

addParameters({
  options: {
    name: '@superset-ui/plugins-deckgl 🔌💡',
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
  },
});

function loadStorybook() {
  require('./storybook.css');
  require('../storybook/stories'); // all of the stories
}

configure(loadStorybook, module);
