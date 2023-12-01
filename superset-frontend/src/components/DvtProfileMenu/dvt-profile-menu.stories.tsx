import React from 'react';
import { Meta } from '@storybook/react';
import DvtProfileMenu, { DvtProfileMenuProps } from '.';

export default {
  title: 'Dvt-Components/DvtProfileMenu',
  component: DvtProfileMenu,
} as Meta;

export const Default = (args: DvtProfileMenuProps) => (
  <DvtProfileMenu {...args} />
);

Default.args = {
  img: 'https://demos.pixinvent.com/vuexy-html-admin-template/assets/img/avatars/1.png',
};

Default.argsTypes = {
  img: {
    control: { type: 'text' },
  },
};
