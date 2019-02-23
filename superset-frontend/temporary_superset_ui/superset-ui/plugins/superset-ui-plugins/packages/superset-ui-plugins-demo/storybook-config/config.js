import { configure } from '@storybook/react';

function loadStorybook() {
  require('./storybook.css');
  require('../storybook/storybookInfo'); // this customizes the UI (labels, etc.)
  require('../storybook/stories'); // all of the stories
}

configure(loadStorybook, module);
