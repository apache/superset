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
  },
};

export const Default = (args: DvtButtonProps) => <DvtButton {...args} />;

Default.args = {
  typeColour: 'primary',
};
