// Button.stories.ts|tsx

import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import { ButtonCell } from './index';

export default {
  title: 'Design System/Components/Table/Cell Renderers/ButtonCell',
  component: ButtonCell,
} as ComponentMeta<typeof ButtonCell>;

const clickHandler = () => alert(`I was Clicked`);

export const Basic: ComponentStory<typeof ButtonCell> = args => (
  <ButtonCell {...args} />
);

Basic.args = {
  onClick: clickHandler,
  label: 'Primary',
};

export const Secondary: ComponentStory<typeof ButtonCell> = args => (
  <ButtonCell {...args} />
);

Secondary.args = {
  onClick: clickHandler,
  label: 'Secondary',
  style: 'secondary',
};
