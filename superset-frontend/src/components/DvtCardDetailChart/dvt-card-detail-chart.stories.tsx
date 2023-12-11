import React from 'react';
import { Meta } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import DvtCardDetailChart, { DvtCardDetailChartProps } from '.';

export default {
  title: 'Dvt-Components/DvtCardDetailChart',
  component: DvtCardDetailChart,
  decorators: [Story => <MemoryRouter>{Story()}</MemoryRouter>],
} as Meta;

export const Default = (args: DvtCardDetailChartProps) => (
  <div style={{ backgroundColor: '#B8C1CC', padding: '20px' }}>
    <div style={{ width: '400px' }}>
      <DvtCardDetailChart {...args} />
    </div>
  </div>
);

Default.args = {
  labelTitle: 'Country of Citizenship',
  vizType: 'World Map',
  dataset: 'public_FCC 2018 Survey',
  modified: new Date(),
  link: '',
};

Default.argsTypes = {
  labelTitle: {
    control: { type: 'text' },
  },
  vizType: {
    control: { type: 'text' },
  },
  dataset: {
    control: { type: 'text' },
  },
  modified: {
    control: { type: 'date' },
  },
};
