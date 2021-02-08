import React from 'react';

import AirbnbPalettes from '@superset-ui/core/src/color/colorSchemes/categorical/airbnb';
import D3Palettes from '@superset-ui/core/src/color/colorSchemes/categorical/d3';
import EchartsPalettes from '@superset-ui/core/src/color/colorSchemes/categorical/echarts';
import GooglePalettes from '@superset-ui/core/src/color/colorSchemes/categorical/google';
import LyftPalettes from '@superset-ui/core/src/color/colorSchemes/categorical/lyft';
import PresetPalettes from '@superset-ui/core/src/color/colorSchemes/categorical/preset';
import SupersetPalettes from '@superset-ui/core/src/color/colorSchemes/categorical/superset';

import SequantialCommonPalettes from '@superset-ui/core/src/color/colorSchemes/sequential/common';
import SequantialD3Palettes from '@superset-ui/core/src/color/colorSchemes/sequential/d3';

import RenderPalettes from './RenderPalettes';

export default {
  title: 'Core Packages|@superset-ui/color',
};

export const categoricalPalettes = () =>
  [
    { palettes: SupersetPalettes, storyName: 'Superset' },
    { palettes: AirbnbPalettes, storyName: 'Airbnb' },
    { palettes: D3Palettes, storyName: 'd3' },
    { palettes: EchartsPalettes, storyName: 'ECharts' },
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
