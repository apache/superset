import React from 'react';

import AirbnbPalettes from '@superset-ui/color/src/colorSchemes/categorical/airbnb';
import D3Palettes from '@superset-ui/color/src/colorSchemes/categorical/d3';
import GooglePalettes from '@superset-ui/color/src/colorSchemes/categorical/google';
import LyftPalettes from '@superset-ui/color/src/colorSchemes/categorical/lyft';
import PresetPalettes from '@superset-ui/color/src/colorSchemes/categorical/preset';
import SupersetPalettes from '@superset-ui/color/src/colorSchemes/categorical/superset';

import SequantialCommonPalettes from '@superset-ui/color/src/colorSchemes/sequential/common';
import SequantialD3Palettes from '@superset-ui/color/src/colorSchemes/sequential/d3';

import RenderPalettes from './RenderPalettes';

export default {
  title: 'Core Packages|@superset-ui/color',
};

export const categoricalPalettes = () =>
  [
    { palettes: SupersetPalettes, storyName: 'Superset' },
    { palettes: AirbnbPalettes, storyName: 'Airbnb' },
    { palettes: D3Palettes, storyName: 'd3' },
    { palettes: GooglePalettes, storyName: 'Google' },
    { palettes: LyftPalettes, storyName: 'Lyft' },
    { palettes: PresetPalettes, storyName: 'Preset' },
  ].map(({ palettes, storyName }) => (
    <RenderPalettes key={storyName} title={storyName} palettes={palettes} />
  ));

export const sequentialPalettes = () =>
  [
    { palettes: SequantialCommonPalettes, storyName: 'Common' },
    { palettes: SequantialD3Palettes, storyName: 'd3' },
  ].map(({ palettes, storyName }) => (
    <RenderPalettes key={storyName} title={storyName} palettes={palettes} />
  ));
