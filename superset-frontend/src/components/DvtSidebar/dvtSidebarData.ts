interface SidebarDataProps {
  pathname: string;
  data: any[];
}

const DvtSidebarData: SidebarDataProps[] = [
  {
    pathname: '/superset/welcome/',
    data: [
      {
        titleMenu: 'folder navigation',
        title: 'menu',
        data: [
          {
            title: 'Connections',
            url: '/databaseview/list/',
            fileName: 'dvt-activity',
          },
          {
            title: 'Dataset',
            url: '/dataset/add/',
            fileName: 'dvt-database',
          },
          {
            title: 'Dashboard',
            url: '/dashboard/list/',
            fileName: 'dvt-box',
          },
          {
            title: 'Report',
            url: '/report/list/',
            fileName: 'dvt-analytic_chart',
          },
          {
            title: 'Alert',
            url: '/alert/list/',
            fileName: 'dvt-alert',
          },
        ],
      },
      {
        titleMenu: 'folder',
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
      {
        titleMenu: 'shared folder',
        title: 'shared folder',
      },
    ],
  },
  {
    pathname: '/databaseview/list/',
    data: [
      {
        label: 'EXPOSE IN SQL LAB',
        values: [
          { label: 'No', value: 'false' },
          { label: 'Yes', value: 'true' },
        ],
        placeholder: 'Select or type a value',
        name: 'expose_in_sqllab',
      },
      {
        label: 'AQE',
        values: [
          { label: 'No', value: 'false' },
          { label: 'Yes', value: 'true' },
        ],
        placeholder: 'Select or type a value',
        name: 'allow_run_async',
      },
      {
        label: 'SEARCH',
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Type a value',
        name: 'search',
      },
    ],
  },
  {
    pathname: '/superset/sqllab/history/',
    data: [
      {
        label: 'Database',
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Select or type a value',
      },
      {
        label: 'State',
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Select or type a value',
      },
      {
        label: 'User',
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Type a value',
      },
      {
        label: 'Time Range',
        values: [],
        placeholder: 'Type a value',
        datePicker: true,
      },
      {
        label: 'Search by Query Text',
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Type a value',
      },
    ],
  },
  {
    pathname: '/tablemodelview/list/',
    data: [
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Owner',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Database',
      },
      {
        values: [
          { label: 'Lorem ıpsum', value: 'failed' },
          { label: 'Dolor Sit Amet', value: 'success' },
          { label: 'Lorem ıpsum', value: 'failed1' },
          { label: 'Dolor Sit Amet', value: 'success1' },
        ],
        placeholder: 'Schema',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Type',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Certified',
      },
    ],
  },
  {
    pathname: '/chart/list/',
    data: [
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Sqlite',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Main',
      },
      {
        values: [],
        valuesList: [
          {
            id: 1,
            subtitle: 'integer',
            title: 'table_schema_id',
          },
          {
            id: 2,
            subtitle: 'string',
            title: 'table_schema_title',
          },
          {
            id: 3,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 4,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 5,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 6,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 7,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 8,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 9,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 10,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 11,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 12,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 13,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 14,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 15,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 16,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 17,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 18,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 19,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 20,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 21,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 22,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 23,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 24,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 25,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 26,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 27,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 28,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 29,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 30,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 31,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
          {
            id: 32,
            subtitle: 'string',
            title: 'table_schema_subtitle',
          },
        ],
        placeholder: 'See Table Schema',
        title: 'FFC 2019 Survey',
      },
    ],
  },
  {
    pathname: '/dashboard/list/',
    data: [
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Owner',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Created by',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Status',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Favorite',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Certified',
      },
    ],
  },
  {
    pathname: '/report/list/',
    data: [
      {
        values: [{ label: 'Superset Admin', value: 'Superset Admin' }],
        placeholder: 'Owner',
        name: 'owner',
      },
      {
        values: [{ label: 'Superset Admin', value: 'Superset Admin' }],
        placeholder: 'Created by',
        name: 'createdBy',
      },
      {
        values: [
          { label: 'Pie Chart', value: 'pie' },
          { label: 'Big Number with Trendline', value: 'big_number' },
          { label: 'Table', value: 'table' },
          { label: 'World Map', value: 'world_map' },
          { label: 'Treemap (legacy)', value: 'treemap' },
          { label: 'Bar Chart', value: 'dist_bar' },
          { label: 'Time-series Bar Chart', value: 'echarts_timeseries_bar' },
          { label: 'Chord Diagram', value: 'chord' },
          { label: 'Heatmap', value: 'heatmap' },
          { label: 'Box Plot', value: 'box_plot' },
          { label: 'Sankey Diagram', value: 'sankey' },
        ],
        placeholder: 'Chart Type',
        name: 'chartType',
      },
      {
        values: [
          { label: 'arac', value: 'dwh.arac' },
          { label: 'alarm_event', value: 'cap.alarm_event' },
          {
            label: 'FCC 2018 Survey',
            value: 'public.FCC 2018 Survey',
          },
          { label: 'video_game_sales', value: 'public.video_game_sales' },
          { label: 'hrrr2', value: 'public.hrrr2' },
          {
            label: 'users_channels-uzooNNtSRO',
            value: 'public.users_channels-uzooNNtSRO',
          },
        ],
        placeholder: 'Dataset',
        name: 'dataset',
      },
      {
        values: [
          { label: 'Unicode Test', value: 'Unicode Test' },
          {
            label: 'COVID Vaccine Dashboard',
            value: 'COVID Vaccine Dashboard',
          },
          { label: 'untitled dashboard', value: 'untitled dashboard' },
          {
            label: 'FCC New Coder Survey 2018',
            value: 'FCC New Coder Survey 2018',
          },
          { label: 'Video Game Sales', value: 'Video Game Sales' },
        ],
        placeholder: 'Dashboards',
        name: 'dashboards',
      },
      {
        values: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' },
        ],
        placeholder: 'Favorite',
        name: 'favorite',
      },
      {
        values: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: null },
        ],
        placeholder: 'Certified',
        name: 'certified',
      },
    ],
  },
  {
    pathname: '/alert/list/',
    data: [
      {
        label: 'Owner',
        values: [{ label: 'Superset Admin', value: 'Superset Admin' }],
        placeholder: 'Select or type a value',
        name: 'owner',
      },
      {
        label: 'Created by',
        values: [{ label: 'Superset Admin', value: 'Superset Admin' }],
        placeholder: 'Select or type a value',
        name: 'createdBy',
      },
      {
        label: 'Status',
        values: [
          { label: 'Error', value: 'Error' },
          { label: 'Success', value: 'Success' },
        ],
        placeholder: 'Select or type a value',
        name: 'status',
      },
      {
        label: 'Search',
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Type a value',
        name: 'search',
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

  {
    pathname: '/chart/add',
    data: [
      {
        values: [{ label: 'Superset Admin', value: 'Superset Admin' }],
        placeholder: 'Dataset',
        name: 'dataset',
      },
      {
        values: [
          { label: 'Lorem ıpsum', value: 'Lorem ıpsum' },
          { label: 'Dolor Sit Amet', value: 'Dolor Sit Amet' },
          { label: 'Lorem ıpsum', value: 'Lorem ıpsum' },
          { label: 'Dolor Sit Amet', value: 'Dolor Sit Amet' },
        ],
        placeholder: 'Recommended Tags',
        name: 'ML_AI',
      },
      {
        values: [
          { label: '#1 Clustered Bar Chart', value: '#1 Clustered Bar Chart' },
          {
            label: '#2 Clustered Column Chart',
            value: '#2 Clustered Column Chart',
          },
          { label: '#3 Combo Chart', value: '#3 Combo Chart' },
          { label: '#4 Area Chart', value: '#4 Area Chart' },
          { label: '#5 Line Chart', value: '#5 Line Chart' },
          { label: '#6 Pie Chart', value: '#6 Pie Chart' },
          { label: '#7 Doughnut Chart', value: '#7 Doughnut Chart' },
          { label: '#7 Doughnut Chart', value: '#7 Doughnut Chart' },
          { label: '#8 Gauge Chart', value: '#8 Gauge Chart' },
        ],
        placeholder: 'Category',
        name: 'category',
      },
      {
        values: [
          { label: 'Lorem ıpsum', value: 'Lorem ıpsum' },
          { label: 'Dolor Sit Amet', value: 'Dolor Sit Amet' },
          { label: 'Lorem ıpsum', value: 'Lorem ıpsum' },
          { label: 'Dolor Sit Amet', value: 'Dolor Sit Amet' },
        ],
        placeholder: 'Tags',
        name: 'chartType',
      },
    ],
  },
];

export default DvtSidebarData;
