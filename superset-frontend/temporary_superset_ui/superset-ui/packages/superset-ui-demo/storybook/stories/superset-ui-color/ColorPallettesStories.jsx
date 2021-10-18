import React from 'react';
import {
  CategoricalAirbnb,
  CategoricalD3,
  CategoricalEcharts,
  CategoricalGoogle,
  CategoricalLyft,
  CategoricalPreset,
  CategoricalSuperset,
  SequentialCommon,
  SequentialD3,
} from '@superset-ui/core';
import RenderPalettes from './RenderPalettes';

export default {
  title: 'Core Packages/@superset-ui-color',
};

export const categoricalPalettes = () =>
  [
    { palettes: CategoricalSuperset, storyName: 'Superset' },
    { palettes: CategoricalAirbnb, storyName: 'Airbnb' },
    { palettes: CategoricalD3, storyName: 'd3' },
    { palettes: CategoricalEcharts, storyName: 'ECharts' },
    { palettes: CategoricalGoogle, storyName: 'Google' },
    { palettes: CategoricalLyft, storyName: 'Lyft' },
    { palettes: CategoricalPreset, storyName: 'Preset' },
  ].map(({ palettes, storyName }) => (
    <RenderPalettes key={storyName} title={storyName} palettes={palettes} />
  ));

export const sequentialPalettes = () =>
  [
    { palettes: SequentialCommon, storyName: 'Common' },
    { palettes: SequentialD3, storyName: 'd3' },
  ].map(({ palettes, storyName }) => (
    <RenderPalettes key={storyName} title={storyName} palettes={palettes} />
  ));
