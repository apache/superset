import React from 'react';
import DvtCard, { DvtCardProps } from './index';

export default {
  title: 'Dvt-Components/DvtCard',
  component: DvtCard,
};

export const Default = (args: DvtCardProps) => <DvtCard {...args} />;

Default.args = {
  title: 'card title',
};

Default.argTypes = {
  title: {
    control: { type: 'text' },
  },
};
