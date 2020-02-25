import '@babel/polyfill';
import { setAddon, storiesOf } from '@storybook/react';
import { withKnobs } from '@storybook/addon-knobs';
import JSXAddon from 'storybook-addon-jsx';
import 'bootstrap/dist/css/bootstrap.min.css';

setAddon(JSXAddon);

const EMPTY_EXAMPLES = [
  {
    renderStory: () => 'Does your default export have an `examples` key?',
    storyName: 'No examples found',
  },
];

/*
 * Below we crawl the dir + subdirs looking for index files of stories
 * Each index is expected to have a default export with examples key containing
 * an array of examples. Each example should have the shape:
 *    { storyPath: string, storyName: string, renderStory: fn() => node }
 *
 */
const requireContext = require.context('./', /* subdirs= */ true, /index\.(j|t)sx?$/);

requireContext.keys().forEach(packageName => {
  const packageExport = requireContext(packageName);
  if (packageExport && packageExport.default && !Array.isArray(packageExport.default)) {
    const { examples = EMPTY_EXAMPLES } = packageExport.default;

    examples.forEach(example => {
      const {
        storyPath = 'Missing story path',
        storyName = 'Missing name',
        renderStory = () => 'Missing `renderStory`',
        options = {},
      } = example;

      storiesOf(storyPath, module)
        .addParameters({ options })
        .addDecorator(withKnobs({ escapeHTML: false }))
        .addWithJSX(storyName, renderStory);
    });
  }
});
