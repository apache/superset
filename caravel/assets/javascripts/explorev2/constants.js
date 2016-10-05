import React from 'react';
import TimeFilter from './components/TimeFilter';
import ChartControl from './components/ChartControl';
import GroupBy from './components/GroupBy';
import SqlClause from './components/SqlClause';
import Filters from './components/Filters';
import NotGroupBy from './components/NotGroupBy';
import Options from './components/Options';

export const VIZ_TYPES = [
  { value: 'dist_bar', label: 'Distribution - Bar Chart', requiresTime: false },
  { value: 'pie', label: 'Pie Chart', requiresTime: false },
  { value: 'line', label: 'Time Series - Line Chart', requiresTime: true },
  { value: 'bar', label: 'Time Series - Bar Chart', requiresTime: true },
  { value: 'compare', label: 'Time Series - Percent Change', requiresTime: true },
  { value: 'area', label: 'Time Series - Stacked', requiresTime: true },
  { value: 'table', label: 'Table View', requiresTime: false },
  { value: 'markup', label: 'Markup', requiresTime: false },
  { value: 'pivot_table', label: 'Pivot Table', requiresTime: false },
  { value: 'separator', label: 'Separator', requiresTime: false },
  { value: 'word_cloud', label: 'Word Cloud', requiresTime: false },
  { value: 'treemap', label: 'Treemap', requiresTime: false },
  { value: 'cal_heatmap', label: 'Calendar Heatmap', requiresTime: true },
  { value: 'box_plot', label: 'Box Plot', requiresTime: false },
  { value: 'bubble', label: 'Bubble Chart', requiresTime: false },
  { value: 'big_number', label: 'Big Number with Trendline', requiresTime: false },
  { value: 'bubble', label: 'Bubble Chart', requiresTime: false },
  { value: 'histogram', label: 'Histogram', requiresTime: false },
  { value: 'sunburst', label: 'Sunburst', requiresTime: false },
  { value: 'sankey', label: 'Sankey', requiresTime: false },
  { value: 'directed_force', label: 'Directed Force Layout', requiresTime: false },
  { value: 'world_map', label: 'World Map', requiresTime: false },
  { value: 'filter_box', label: 'Filter Box', requiresTime: false },
  { value: 'iframe', label: 'iFrame', requiresTime: false },
  { value: 'para', label: 'Parallel Coordinates', requiresTime: false },
  { value: 'heatmap', label: 'Heatmap', requiresTime: false },
  { value: 'horizon', label: 'Horizon', requiresTime: false },
  { value: 'mapbox', label: 'Mapbox', requiresTime: false },
];

export const sinceOptions = ['1 hour ago', '12 hours ago', '1 day ago',
  '7 days ago', '28 days ago', '90 days ago', '1 year ago'];
export const untilOptions = ['now', '1 day ago', '7 days ago',
  '28 days ago', '90 days ago', '1 year ago'];

export const timestampOptions = [
    ['smart_date', 'Adaptative formating'],
    ['%m/%d/%Y', '"%m/%d/%Y" | 01/14/2019'],
    ['%Y-%m-%d', '"%Y-%m-%d" | 2019-01-14'],
    ['%Y-%m-%d %H:%M:%S',
     '"%Y-%m-%d %H:%M:%S" | 2019-01-14 01:32:10'],
    ['%H:%M:%S', '"%H:%M:%S" | 01:32:10'],
];

export const rowLimitOptions = [10, 50, 100, 250, 500, 1000, 5000, 10000, 50000];

export const DefaultControls = (
  <div>
    <ChartControl />
    <TimeFilter />
    <GroupBy />
    <SqlClause />
    <Filters />
  </div>
);

export const TableVizControls = (
  <div>
    <NotGroupBy />
    <Options />
  </div>
);

export const VIZ_CONTROL_MAPPING = {
  table: TableVizControls,
};
