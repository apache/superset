import React from 'react';
import DvtTitleTotal, { DvtTitleTotalProps } from '.';

export default {
  title: 'Dvt-Components/DvtTitleTotal',
  component: DvtTitleTotal,
};

export const Default = (args: DvtTitleTotalProps) => (
  <DvtTitleTotal {...args} />
);

Default.args = {
  title: "What's New",
  total: 15,
};

Default.argsTypes = {
  title: {
    control: { type: 'text' },
  },
  total: {
    control: { type: 'number' },
  },
};
