import React from 'react';
import { Panel } from 'react-bootstrap';
import * as V from 'victory';

const ChartContainer = function () {
  return (
    <Panel
      header={<div className="panel-title">Chart Title</div>}
    >
      <V.VictoryChart height={200}>
        <V.VictoryAxis
          style={
            {
              axisLabel: {fontsize: 8, fontFamily: 'Roboto'},
            }
          }
          padding={20}
        />
        <V.VictoryAxis
          dependentAxis
          padding={20}
          style={
            {
              axisLabel: {fontsize: 8, fontFamily: 'Roboto'},
            }
          }
        />
        <V.VictoryBar
          style={{
            data: {fill: "blue", width: 20},
            labels: {fontSize: 10}
          }}
          data={[
            {x: 1, y: 1},
            {x: 2, y: 2},
            {x: 3, y: 3},
            {x: 4, y: 2},
            {x: 5, y: 1},
          ]}
        />
      </V.VictoryChart>
    </Panel>
  );
};
export default ChartContainer;
