import '@babel/polyfill';
import { setAddon, storiesOf } from '@storybook/react';
import { withKnobs } from '@storybook/addon-knobs';
import JSXAddon from 'storybook-addon-jsx';
import categoricalD3 from '@superset-ui/core/lib/color/colorSchemes/categorical/d3';
import sequentialCommon from '@superset-ui/core/lib/color/colorSchemes/sequential/common';
import sequentialD3 from '@superset-ui/core/lib/color/colorSchemes/sequential/d3';
import { configure } from '@superset-ui/core';
import {
  getTimeFormatterRegistry,
  smartDateFormatter,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
} from '@superset-ui/core';

setAddon(JSXAddon);

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
const requireContext = require.context('./', /* subdirs= */ true, /index\.jsx?$/);

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
        .addDecorator(withKnobs)
        .addWithJSX(storyName, renderStory);
    });
  }
});
