import React from 'react';
import DvtTitlePlus, { DvtTitlePlusProps } from '.';

export default {
  title: 'Dvt-Components/DvtTitlePlus',
  component: DvtTitlePlus,
};

export const Default = (args: DvtTitlePlusProps) => (
  <div style={{ width: 186 }}>
    <DvtTitlePlus {...args} />
  </div>
);

Default.args = {
  title: 'title-plus title',
  plus: false,
};

Default.argTypes = {
  title: {
    control: { type: 'text' },
  },
  plus: {
    control: { type: 'boolean' },
  },
};
