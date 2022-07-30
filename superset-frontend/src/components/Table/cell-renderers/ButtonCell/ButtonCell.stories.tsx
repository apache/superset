// Button.stories.ts|tsx

import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import { ButtonCell } from './index';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Components/Table/Cell Renderers/ButtonCell',
  component: ButtonCell,
} as ComponentMeta<typeof ButtonCell>;

const clikerit = (message: string) => alert(`I waz Clicekd: ${message}`);

export const Examples: ComponentStory<typeof ButtonCell> = args => (
  <ButtonCell {...args} />
);

Examples.args = {
  handleClick: clikerit,
  label: 'Example',
};
