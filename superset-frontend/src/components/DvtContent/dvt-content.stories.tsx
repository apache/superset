import React from 'react';
import { Meta } from '@storybook/react';
import DvtContent, { DvtContentProps } from '.';

export default {
  title: 'Dvt-Components/DvtContent',
  component: DvtContent,
} as Meta;

export const Default = (args: DvtContentProps) => <DvtContent {...args} />;

Default.args = {
  title: 'Custom Title',
  header: 'Header Example',
  data: [
    { id: 1, name: 'Item 1', type: 'Example Type A', created: new Date() },
    { id: 2, name: 'Item 2', type: 'Example Type B', created: new Date() },
  ],
};
