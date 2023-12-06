interface SidebarDataProps {
  pathname: string;
  data: any[];
}

const DvtSidebarData: SidebarDataProps[] = [
  {
    pathname: '/superset/welcome/',
    data: [
      {
        navigationData: [
          {
            title: 'menu',
            data: [
              {
                title: 'Connections',
                url: '/',
                fileName: 'dvt-activity',
              },
              {
                title: 'Dataset',
                url: '/',
                fileName: 'dvt-database',
              },
              {
                title: 'Dashboard',
                url: '/',
                fileName: 'dvt-box',
              },
              {
                title: 'Report',
                url: '/',
                fileName: 'dvt-analytic_chart',
              },
              {
                title: 'Alert',
                url: '/',
                fileName: 'dvt-alert',
              },
            ],
          },
        ],
        folderNavigationData: [
          {
            title: 'my folder',
            data: [
              {
                name: 'Dnext',
                url: '',
                data: [
                  {
                    name: 'Dashboard 1',
                    url: '',
                    data: [
                      {
                        name: 'Report 1',
                        url: '/dashboard/1/report/1',
                        data: [],
                      },
                      {
                        name: 'Report 2',
                        url: '/dashboard/1/report/2',
                        data: [],
                      },
                    ],
                  },
                  {
                    name: 'Dashboard 2',
                    url: '/dashboard/2',
                    data: [],
                  },
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
          },
        ],
        items: [
          {
            title: 'shared folder',
          },
        ],
      },
    ],
  },
  {
    pathname: '/dataset/add/',
    data: [
      {
        selectData: [
          {
            label: 'Owner',
            values: [
              { label: 'Failed', value: 'failed' },
              { label: 'Success', value: 'success' },
            ],
            placeholder: 'Select or type a value',
          },
          {
            label: 'Created By',
            values: [
              { label: 'Failed', value: 'failed' },
              { label: 'Success', value: 'success' },
            ],
            placeholder: 'Select or type a value',
          },
          {
            label: 'Status',
            values: [
              { label: 'Failed', value: 'failed' },
              { label: 'Success', value: 'success' },
            ],
            placeholder: 'Select or type a value',
          },
          {
            label: 'Search',
            values: [
              { label: 'Failed', value: 'failed' },
              { label: 'Success', value: 'success' },
            ],
            placeholder: 'Type a value',
          },
        ],
      },
    ],
  },

  {
    pathname: '/superset/profile/admin/',
    data: [
      {
        items: [
          {
            icon: 'dvt-briefcase',
            label: 'Created Content',
            url: 'test',
          },
          {
            icon: 'dvt-calendar',
            label: 'Schedule',
            url: 'test1',
          },
          {
            icon: 'dvt-history',
            label: 'Recent Activity',
            url: 'test2',
          },
          {
            icon: 'dvt-star',
            label: 'Favorites',
            url: 'test3',
          },
          {
            icon: 'dvt-users',
            label: 'Groups and Roles',
            url: 'test4',
          },
          {
            icon: 'dvt-arrow_forwardup',
            label: 'Query History',
            url: 'test5',
          },
        ],
        itemsLogout: [
          {
            icon: 'dvt-logout',
            label: 'Log Out',
          },
        ],
      },
    ],
  },
];

export default DvtSidebarData;
