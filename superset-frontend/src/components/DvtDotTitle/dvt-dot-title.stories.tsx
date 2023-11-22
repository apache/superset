import React from 'react';
import DvtDotTitle, { DvtDotTitleProps } from '.';

export default {
  title: 'Dvt-Components/DvtDotTitle',
  component: DvtDotTitle,
};

export const Default = (args: DvtDotTitleProps) => (
  <DvtDotTitle label="Welcome Page" {...args} />
);
export const Connection = (args: DvtDotTitleProps) => (
  <DvtDotTitle label="Connection" {...args} />
);
export const SQL = (args: DvtDotTitleProps) => (
  <DvtDotTitle label="SQL" {...args} />
);
