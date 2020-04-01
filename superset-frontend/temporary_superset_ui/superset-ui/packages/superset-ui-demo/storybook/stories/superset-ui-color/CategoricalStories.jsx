import React from 'react';

import AirbnbPalettes from '@superset-ui/color/lib/colorSchemes/categorical/airbnb';
import D3Palettes from '@superset-ui/color/lib/colorSchemes/categorical/d3';
import GooglePalettes from '@superset-ui/color/lib/colorSchemes/categorical/google';
import LyftPalettes from '@superset-ui/color/lib/colorSchemes/categorical/lyft';
import RenderPalettes from './RenderPalettes';

export default [
  {
    renderStory: () =>
      [
        { palettes: AirbnbPalettes, storyName: 'Airbnb' },
        { palettes: D3Palettes, storyName: 'd3' },
        { palettes: GooglePalettes, storyName: 'Google' },
        { palettes: LyftPalettes, storyName: 'Lyft' },
      ].map(({ palettes, storyName }) => (
        <RenderPalettes key={storyName} title={storyName} palettes={palettes} />
      )),
    storyName: 'Categorical Palettes',
    storyPath: '@superset-ui/color',
  },
];
