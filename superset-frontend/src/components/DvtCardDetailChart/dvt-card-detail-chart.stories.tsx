import React from 'react';
import { Meta } from '@storybook/react';
import DvtCardDetailChart, { DvtCardDetailChartProps } from '.';
import { MemoryRouter } from 'react-router-dom';

export default {
  title: 'Dvt-Components/DvtCardDetailChart',
  component: DvtCardDetailChart,
  decorators: [Story => <MemoryRouter>{Story()}</MemoryRouter>],
} as Meta;

export const Default = (args: DvtCardDetailChartProps) => (
  <DvtCardDetailChart {...args} />
);

Default.args = {
  labelTitle: 'Country of Citizenship',
  vizType: 'World Map',
  dataset: 'public_FCC 2018 Survey',
  modified: '2 mounths ago',
  link: '',
},

Default.argsTypes = {
  labelTitle: {
    control: { type: 'text' },
  },
  vizType: {
    control: {type: 'text'},
  },
  dataset: {
    control: {type:'text'},
  },
  modified: {
    control: {type: 'text'},
  },
};
