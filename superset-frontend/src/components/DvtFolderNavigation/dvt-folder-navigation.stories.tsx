import React from 'react';
import DvtFolderNavigation, { DvtFolderNavigationProps } from '.';
import { MemoryRouter } from 'react-router-dom';

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
            { name: 'Report 1', url: '' },
            { name: 'Report 2', url: '' },
          ],
        },
        { name: 'Dashboard 2 ', url: '', data: [] },
      ],
    },
    {
      name: 'Planning',
      url: '',
      data: [],
    },
    {
      name: 'Reporting',
      url: '',
      data: [],
    },
  ],
};

Default.argTypes = {
  data: {
    control: { type: 'object' },
  },
};
