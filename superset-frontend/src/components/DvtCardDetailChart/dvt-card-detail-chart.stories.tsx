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
    defaultValue: new Date('2023-11-30T00:34:23Z'),
  },
};
