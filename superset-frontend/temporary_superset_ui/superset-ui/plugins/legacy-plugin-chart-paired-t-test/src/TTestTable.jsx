/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-disable react/no-array-index-key, react/jsx-no-bind */
import dist from 'distributions';
import React from 'react';
import { Table, Tr, Td, Thead, Th } from 'reactable';
import PropTypes from 'prop-types';

export const dataPropType = PropTypes.arrayOf(
  PropTypes.shape({
    group: PropTypes.arrayOf(PropTypes.string),
    values: PropTypes.arrayOf(
      PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
      }),
    ),
  }),
);

const propTypes = {
  alpha: PropTypes.number,
  data: dataPropType.isRequired,
  groups: PropTypes.arrayOf(PropTypes.string).isRequired,
  liftValPrec: PropTypes.number,
  metric: PropTypes.string.isRequired,
  pValPrec: PropTypes.number,
};

const defaultProps = {
  alpha: 0.05,
  liftValPrec: 4,
  pValPrec: 6,
};

class TTestTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      control: 0,
      liftValues: [],
      pValues: [],
    };
  }

  componentDidMount() {
    const { control } = this.state;
    this.computeTTest(control); // initially populate table
  }

  getLiftStatus(row) {
    const { control, liftValues } = this.state;
    // Get a css class name for coloring
    if (row === control) {
      return 'control';
    }
    const liftVal = liftValues[row];
    if (Number.isNaN(liftVal) || !Number.isFinite(liftVal)) {
      return 'invalid'; // infinite or NaN values
    }

    return liftVal >= 0 ? 'true' : 'false'; // green on true, red on false
  }

  getPValueStatus(row) {
    const { control, pValues } = this.state;
    if (row === control) {
      return 'control';
    }
    const pVal = pValues[row];
    if (Number.isNaN(pVal) || !Number.isFinite(pVal)) {
      return 'invalid';
    }

    return ''; // p-values won't normally be colored
  }

  getSignificance(row) {
    const { control, pValues } = this.state;
    const { alpha } = this.props;
    // Color significant as green, else red
    if (row === control) {
      return 'control';
    }

    // p-values significant below set threshold
    return pValues[row] <= alpha;
  }

  computeLift(values, control) {
    const { liftValPrec } = this.props;
    // Compute the lift value between two time series
    let sumValues = 0;
    let sumControl = 0;
    values.forEach((value, i) => {
      sumValues += value.y;
      sumControl += control[i].y;
    });

    return (((sumValues - sumControl) / sumControl) * 100).toFixed(liftValPrec);
  }

  computePValue(values, control) {
    const { pValPrec } = this.props;
    // Compute the p-value from Student's t-test
    // between two time series
    let diffSum = 0;
    let diffSqSum = 0;
    let finiteCount = 0;
    values.forEach((value, i) => {
      const diff = control[i].y - value.y;
      /* eslint-disable-next-line */
      if (isFinite(diff)) {
        finiteCount += 1;
        diffSum += diff;
        diffSqSum += diff * diff;
      }
    });
    const tvalue = -Math.abs(
      diffSum *
        Math.sqrt(
          (finiteCount - 1) / (finiteCount * diffSqSum - diffSum * diffSum),
        ),
    );
    try {
      return (2 * new dist.Studentt(finiteCount - 1).cdf(tvalue)).toFixed(
        pValPrec,
      ); // two-sided test
    } catch (error) {
      return NaN;
    }
  }

  computeTTest(control) {
    // Compute lift and p-values for each row
    // against the selected control
    const { data } = this.props;
    const pValues = [];
    const liftValues = [];
    if (!data) {
      return;
    }
    for (let i = 0; i < data.length; i += 1) {
      if (i === control) {
        pValues.push('control');
        liftValues.push('control');
      } else {
        pValues.push(this.computePValue(data[i].values, data[control].values));
        liftValues.push(this.computeLift(data[i].values, data[control].values));
      }
    }
    this.setState({ control, liftValues, pValues });
  }

  render() {
    const { data, metric, groups } = this.props;
    const { control, liftValues, pValues } = this.state;

    if (!Array.isArray(groups) || groups.length === 0) {
      throw Error('Group by param is required');
    }

    // Render column header for each group
    const columns = groups.map((group, i) => (
      <Th key={i} column={group}>
        {group}
      </Th>
    ));
    const numGroups = groups.length;
    // Columns for p-value, lift-value, and significance (true/false)
    columns.push(
      <Th key={numGroups + 1} column="pValue">
        p-value
      </Th>,
    );
    columns.push(
      <Th key={numGroups + 2} column="liftValue">
        Lift %
      </Th>,
    );
    columns.push(
      <Th key={numGroups + 3} column="significant">
        Significant
      </Th>,
    );
    const rows = data.map((entry, i) => {
      const values = groups.map(
        (
          group,
          j, // group names
        ) => <Td key={j} column={group} data={entry.group[j]} />,
      );
      values.push(
        <Td
          key={numGroups + 1}
          className={this.getPValueStatus(i)}
          column="pValue"
          data={pValues[i]}
        />,
      );
      values.push(
        <Td
          key={numGroups + 2}
          className={this.getLiftStatus(i)}
          column="liftValue"
          data={liftValues[i]}
        />,
      );
      values.push(
        <Td
          key={numGroups + 3}
          className={this.getSignificance(i).toString()}
          column="significant"
          data={this.getSignificance(i)}
        />,
      );

      return (
        <Tr
          key={i}
          className={i === control ? 'control' : ''}
          onClick={this.computeTTest.bind(this, i)}
        >
          {values}
        </Tr>
      );
    });
    // When sorted ascending, 'control' will always be at top
    const sortConfig = groups.concat([
      {
        column: 'pValue',
        sortFunction: (a, b) => {
          if (a === 'control') {
            return -1;
          }
          if (b === 'control') {
            return 1;
          }

          return a > b ? 1 : -1; // p-values ascending
        },
      },
      {
        column: 'liftValue',
        sortFunction: (a, b) => {
          if (a === 'control') {
            return -1;
          }
          if (b === 'control') {
            return 1;
          }

          return parseFloat(a) > parseFloat(b) ? -1 : 1; // lift values descending
        },
      },
      {
        column: 'significant',
        sortFunction: (a, b) => {
          if (a === 'control') {
            return -1;
          }
          if (b === 'control') {
            return 1;
          }

          return a > b ? -1 : 1; // significant values first
        },
      },
    ]);

    return (
      <div>
        <h3>{metric}</h3>
        <Table className="table" id={`table_${metric}`} sortable={sortConfig}>
          <Thead>{columns}</Thead>
          {rows}
        </Table>
      </div>
    );
  }
}

TTestTable.propTypes = propTypes;
TTestTable.defaultProps = defaultProps;

export default TTestTable;
