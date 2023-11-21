import React from 'react';
import DvtDotTitle, { DvtDotTitleProps } from '.';

export default {
  title: 'Dvt-Components/DvtDotTitle',
  component: DvtDotTitle,
};

export const Default = (args: DvtDotTitleProps) => {
  return <DvtDotTitle label="Welcome Page" {...args} />;
};

export const Connection = (args: DvtDotTitleProps) => {
  return <DvtDotTitle label="Connection" {...args} />;
};

export const SQL = (args: DvtDotTitleProps) => {
  return <DvtDotTitle label="SQL" {...args} />;
};
