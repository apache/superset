import React from 'react';

import CommonPalettes from '@superset-ui/color/lib/colorSchemes/sequential/common';
import D3Palettes from '@superset-ui/color/lib/colorSchemes/sequential/d3';
import RenderPalettes from './RenderPalettes';

export default [
  {
    renderStory: () =>
      [
        { palettes: CommonPalettes, storyName: 'Common' },
        { palettes: D3Palettes, storyName: 'd3' },
      ].map(({ palettes, storyName }) => (
        <RenderPalettes key={storyName} title={storyName} palettes={palettes} />
      )),
    storyName: 'Sequential Palettes',
    storyPath: '@superset-ui/color',
  },
];
