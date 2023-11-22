// stories.tsx
import React from 'react';
import DvtButton, { DvtButtonProps } from '.';

export default {
  title: 'Dvt-Components/DvtButton',
  component: DvtButton,
  argTypes: {
    label: {
      control: { type: 'text' },
    },
    colour: {
      control: {
        type: 'select',
        options: ['primary', 'success', 'grayscale'],
      },
    },
    typeColour: {
      control: {
        type: 'select',
        options: ['basic', 'powder', 'outline'],
      },
    },
    icon: {
      control: { type: 'text' },
    },
    onClick: {
      action: 'clicked',
    },
  },
};

export const Default = (args: DvtButtonProps) => <DvtButton {...args} />;

Default.args = {
  label: 'Create a New Graph/Chart',
  typeColour: 'primary',
};
