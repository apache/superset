import React from 'react';
import TimeFilter from './components/TimeFilter';
import ChartControl from './components/ChartControl';
import GroupBy from './components/GroupBy';
import SqlClause from './components/SqlClause';
import Filters from './components/Filters';
import NotGroupBy from './components/NotGroupBy';
import Options from './components/Options';

export const sinceOptions = [
  '1 hour ago',
  '12 hours ago',
  '1 day ago',
  '7 days ago',
  '28 days ago',
  '90 days ago',
  '1 year ago',
];

export const untilOptions = [
  'now',
  '1 day ago',
  '7 days ago',
  '28 days ago',
  '90 days ago',
  '1 year ago',
];

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
