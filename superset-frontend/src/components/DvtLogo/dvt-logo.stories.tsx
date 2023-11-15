import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import DvtLogo, { DvtLogoProps } from '.';

export default {
  title: 'Dvt-Components/DvtLogo',
  component: DvtLogo,
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export const Default = (args: DvtLogoProps) => <DvtLogo {...args} />;

Default.args = {
  title: 'AppName',
};

Default.argTypes = {
  title: {
    control: { type: 'text' },
  },
};
