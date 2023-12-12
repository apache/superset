import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import DvtCardDetailChart, { DvtCardDetailChartProps } from '.';

export default {
  title: 'Dvt-Components/DvtCardDetailChart',
  component: DvtCardDetailChart,
  argTypes: {
    labelTitle: {
      control: { type: 'text' },
      defaultValue: 'Country of Citizenship',
    },
    vizTypeLabel: {
      control: { type: 'text' },
      defaultValue: 'World Map',
    },
    datasetLabel: {
      control: { type: 'text' },
      defaultValue: 'public_FCC 2018 Survey',
    },
    datasetLink: {
      control: { type: 'text' },
      defaultValue: '/',
    },
    modified: {
      control: { type: 'date' },
      defaultValue: new Date(),
    },
  },
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export const Default = (args: DvtCardDetailChartProps) => (
  <div style={{ backgroundColor: '#E2E8F0', padding: '20px', height: '85vh' }}>
    <div style={{ width: '400px' }}>
      <DvtCardDetailChart {...args} />
    </div>
  </div>
);
