import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import DvtFolderNavigation, { DvtFolderNavigationProps } from '.';

export default {
  title: 'Dvt-Components/DvtFolderNavigation',
  component: DvtFolderNavigation,
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export const Default = (args: DvtFolderNavigationProps) => (
  <DvtFolderNavigation {...args} />
);

Default.args = {
  data: [
    {
      name: 'Dnext',
      url: '',
      data: [
        {
          name: 'Dashboard 1',
          url: '',
          data: [
            { name: 'Report 1', url: '/dashboard/1/report/1' },
            { name: 'Report 2', url: '/dashboard/1/report/2' },
          ],
        },
        { name: 'Dashboard 2 ', url: '/dashboard/2', data: [] },
      ],
    },
    {
      name: 'Planning',
      url: '/planning',
      data: [],
    },
    {
      name: 'Reporting',
      url: '/reporting',
      data: [],
    },
  ],
};

Default.argTypes = {
  data: {
    control: { type: 'object' },
  },
};
