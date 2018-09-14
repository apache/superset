import dist from 'distributions';
import React from 'react';
import { Table, Tr, Td, Thead, Th } from 'reactable';
import PropTypes from 'prop-types';

export const dataPropType = PropTypes.arrayOf(PropTypes.shape({
  group: PropTypes.arrayOf(PropTypes.string),
  values: PropTypes.arrayOf(PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  })),
}));

const propTypes = {
  metric: PropTypes.string.isRequired,
  groups: PropTypes.arrayOf(PropTypes.string).isRequired,
  data: dataPropType.isRequired,
  alpha: PropTypes.number,
  liftValPrec: PropTypes.number,
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
      pValues: [],
      liftValues: [],
      control: 0,
    };
  }

  componentWillMount() {
    this.computeTTest(this.state.control); // initially populate table
  }

  getLiftStatus(row) {
    // Get a css class name for coloring
    if (row === this.state.control) {
      return 'control';
    }
    const liftVal = this.state.liftValues[row];
    if (Number.isNaN(liftVal) || !Number.isFinite(liftVal)) {
      return 'invalid'; // infinite or NaN values
    }
    return liftVal >= 0 ? 'true' : 'false'; // green on true, red on false
  }

  getPValueStatus(row) {
    if (row === this.state.control) {
      return 'control';
    }
    const pVal = this.state.pValues[row];
    if (Number.isNaN(pVal) || !Number.isFinite(pVal)) {
      return 'invalid';
    }
    return ''; // p-values won't normally be colored
  }

  getSignificance(row) {
    // Color significant as green, else red
    if (row === this.state.control) {
      return 'control';
    }
    // p-values significant below set threshold
    return this.state.pValues[row] <= this.props.alpha;
  }

  computeLift(values, control) {
    // Compute the lift value between two time series
    let sumValues = 0;
    let sumControl = 0;
    for (let i = 0; i < values.length; i++) {
      sumValues += values[i].y;
      sumControl += control[i].y;
    }
    return (((sumValues - sumControl) / sumControl) * 100)
      .toFixed(this.props.liftValPrec);
  }

  computePValue(values, control) {
    // Compute the p-value from Student's t-test
    // between two time series
    let diffSum = 0;
    let diffSqSum = 0;
    let finiteCount = 0;
    for (let i = 0; i < values.length; i++) {
      const diff = control[i].y - values[i].y;
      if (global.isFinite(diff)) {
        finiteCount++;
        diffSum += diff;
        diffSqSum += diff * diff;
      }
    }
    const tvalue = -Math.abs(diffSum *
      Math.sqrt((finiteCount - 1) /
      (finiteCount * diffSqSum - diffSum * diffSum)));
    try {
      return (2 * new dist.Studentt(finiteCount - 1).cdf(tvalue))
        .toFixed(this.props.pValPrec); // two-sided test
    } catch (err) {
      return NaN;
    }
  }

  computeTTest(control) {
    // Compute lift and p-values for each row
    // against the selected control
    const data = this.props.data;
    const pValues = [];
    const liftValues = [];
    if (!data) {
      return;
    }
    for (let i = 0; i < data.length; i++) {
      if (i === control) {
        pValues.push('control');
        liftValues.push('control');
      } else {
        pValues.push(this.computePValue(data[i].values, data[control].values));
        liftValues.push(this.computeLift(data[i].values, data[control].values));
      }
    }
    this.setState({ pValues, liftValues, control });
  }

  render() {
    const data = this.props.data;
    const metric = this.props.metric;
    const groups = this.props.groups;
    // Render column header for each group
    const columns = groups.map((group, i) => (
      <Th key={i} column={group}>{group}</Th>
    ));
    const numGroups = groups.length;
    // Columns for p-value, lift-value, and significance (true/false)
    columns.push(<Th key={numGroups + 1} column="pValue">p-value</Th>);
    columns.push(<Th key={numGroups + 2} column="liftValue">Lift %</Th>);
    columns.push(<Th key={numGroups + 3} column="significant">Significant</Th>);
    const rows = data.map((entry, i) => {
      const values = groups.map((group, j) => ( // group names
        <Td key={j} column={group} data={entry.group[j]} />
      ));
      values.push(
        <Td
          key={numGroups + 1}
          className={this.getPValueStatus(i)}
          column="pValue"
          data={this.state.pValues[i]}
        />,
      );
      values.push(
        <Td
          key={numGroups + 2}
          className={this.getLiftStatus(i)}
          column="liftValue"
          data={this.state.liftValues[i]}
        />,
      );
      values.push(
        <Td
          key={numGroups + 3}
          className={this.getSignificance(i)}
          column="significant"
          data={this.getSignificance(i)}
        />,
      );
      return (
        <Tr
          key={i}
          onClick={this.computeTTest.bind(this, i)}
          className={i === this.state.control ? 'control' : ''}
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
        <Table
          className="table"
          id={`table_${metric}`}
          sortable={sortConfig}
        >
          <Thead>
            {columns}
          </Thead>
          {rows}
        </Table>
      </div>
    );
  }
}

TTestTable.propTypes = propTypes;
TTestTable.defaultProps = defaultProps;

export default TTestTable;
