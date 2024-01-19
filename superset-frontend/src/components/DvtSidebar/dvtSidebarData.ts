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
    pathname: '/superset/sqllab/saved_queries/',
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
        label: 'Schema',
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Select or type a value',
      },
      {
        label: 'Tags',
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Type a value',
      },
      {
        label: 'Search',
        values: [],
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
        name: 'owner',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Database',
        name: 'database',
      },
      {
        values: [
          { label: 'Lorem ıpsum', value: 'failed' },
          { label: 'Dolor Sit Amet', value: 'success' },
          { label: 'Lorem ıpsum', value: 'failed1' },
          { label: 'Dolor Sit Amet', value: 'success1' },
        ],
        placeholder: 'Schema',
        name: 'schema',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Type',
        name: 'type',
      },
      {
        values: [
          { label: 'Failed', value: 'failed' },
          { label: 'Success', value: 'success' },
        ],
        placeholder: 'Certified',
        name: 'certified',
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
    pathname: '/dataset/add/',
    data: [
      {
        values: [
          { label: 'postgresql examples', value: 'postgresql_examples' },
          { label: 'postgresql PostgreSQL', value: 'postgresql_postgresql' },
        ],
        placeholder: 'DATABASE',
        name: 'database',
      },
      {
        values: [{ label: 'Schema', value: 'schema' }],
        placeholder: 'SCHEMA',
        name: 'schema',
      },
    ],
  },
  {
    pathname: '/dashboard/list/',
    data: [
      {
        values: [],
        placeholder: 'Owner',
        name: 'owner',
      },
      {
        values: [],
        placeholder: 'Created by',
        name: 'createdBy',
      },
      {
        values: [
          { label: 'Published', value: '!t' },
          { label: 'Draft', value: '!f' },
        ],
        placeholder: 'Status',
        name: 'status',
      },
      {
        values: [
          { label: 'Yes', value: '!t' },
          { label: 'No', value: '!f' },
        ],
        placeholder: 'Favorite',
        name: 'favorite',
      },
      {
        values: [
          { label: 'Yes', value: '!t' },
          { label: 'No', value: '!f' },
        ],
        placeholder: 'Certified',
        name: 'certified',
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
        placeholder: 'Dataset',
        name: 'dataset',
      },
      {
        values: [
          { label: 'Popular', value: 'popular' },
          { label: 'ECharts', value: 'echarts' },
          { label: 'Advanced-Analytics', value: 'advanced_analytics' },
        ],
        placeholder: 'Recommended Tags',
        name: 'recommended_tags',
      },
      {
        placeholder: 'Category',
        name: 'category',
      },
      {
        placeholder: 'Tags',
        name: 'tags',
      },
    ],
  },
];

const DefaultOrder = [
  'line',
  'big_number',
  'big_number_total',
  'table',
  'pivot_table_v2',
  'echarts_timeseries_line',
  'echarts_area',
  'echarts_timeseries_bar',
  'echarts_timeseries_scatter',
  'pie',
  'mixed_timeseries',
  'filter_box',
  'dist_bar',
  'area',
  'bar',
  'deck_polygon',
  'time_table',
  'histogram',
  'deck_scatter',
  'deck_hex',
  'time_pivot',
  'deck_arc',
  'heatmap',
  'deck_grid',
  'deck_screengrid',
  'treemap_v2',
  'box_plot',
  'sunburst',
  'sankey',
  'word_cloud',
  'mapbox',
  'kepler',
  'cal_heatmap',
  'rose',
  'bubble',
  'bubble_v2',
  'deck_geojson',
  'horizon',
  'deck_multi',
  'compare',
  'partition',
  'event_flow',
  'deck_path',
  'graph_chart',
  'world_map',
  'paired_ttest',
  'para',
  'country_map',
];

export { DvtSidebarData, DefaultOrder };
