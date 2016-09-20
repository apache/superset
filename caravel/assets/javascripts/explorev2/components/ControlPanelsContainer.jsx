import React from 'react';
import { Panel } from 'react-bootstrap';
import TimeFilter from './TimeFilter';
import ChartControl from './ChartControl';
import GroupBy from './GroupBy';
import SqlClause from './SqlClause';
import Filters from './Filters';

const ControlPanelsContainer = function () {
  return (
    <Panel>
      <ChartControl />
      <TimeFilter />
      <GroupBy />
      <SqlClause />
      <Filters />
    </Panel>
  );
};
export default ControlPanelsContainer;
