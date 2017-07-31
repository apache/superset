/* eslint camelcase: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import dist from 'distributions';

import { connect } from 'react-redux';
import { Table } from 'react-bootstrap';


const propTypes = {
  queryResponse: PropTypes.object,
  viz_type: PropTypes.string.isRequired,
  metrics: PropTypes.number.isRequired,
};

class PairedTTestTableContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      table: Array(0),
    };
  }

  componentWillReceiveProps(nextProps) {
    if (JSON.stringify(nextProps.queryResponse) !== JSON.stringify(this.props.queryResponse)) {
      this.pairedTTestQuery();
    }
  }

  componentDidUpdate(prevProps) {
    if (JSON.stringify(prevProps.queryResponse) !== JSON.stringify(this.props.queryResponse)) {
      this.pairedTTestQuery();
    }
  }

  getTTestValueClass(row) {
    if (row === 'control') {
      return row;
    }
    return row > 0.05 ? 'color-red' : 'color-green';
  }

  getLiftClass(row) {
    if (row === 'control') {
      return row;
    }
    return row >= 0 ? 'color-green' : 'color-red';
  }

  computePairedTTest(data, control) {
    // compute the paired t-test values and update state
    const dataLength = data ? data.length : 0;
    const pValueTable = Array(dataLength);
    for (let i = 0; i < dataLength; i += 1) {
      if (i === control) {
        pValueTable[i] = {
          pval: 'control', lift: 'control', stream: data[i].key, highlight: true,
        };
        continue;
      }
      const currentPairedTTest = this.statsPairedTTest(data[i].values, data[control].values);
      const currentLift = this.statsLift(data[i].values, data[control].values);
      pValueTable[i] = {
        pval: currentPairedTTest, lift: currentLift, stream: data[i].key, highlight: false,
      };
    }
    this.setState({ table: pValueTable });
  }

  pairedTTestQuery(control = 0) {
    // check the viz_type and compute the paired t-test values
    if (this.props.viz_type === 'line_ttest' && this.props.queryResponse) {
      this.computePairedTTest(this.props.queryResponse.data, control);
    }
  }

  statsLift(aa, bb) {
    // compute the lift between two arrays
    let a_sum = 0;
    let b_sum = 0;
    for (let i = 0; i < aa.length; ++i) {
      a_sum += aa[i].y;
      b_sum += bb[i].y;
    }
    return (((a_sum - b_sum) / b_sum) * 100).toFixed(4);
  }

  statsPairedTTest(aa, bb) {
    // calculate the paired t-test values between two arrays
    let ii;
    let sum = 0;
    let nn = 0;
    let ss = 0;
    for (ii = 0; ii < aa.length; ii += 1) {
      const diff = bb[ii].y - aa[ii].y;
      if (global.isFinite(diff)) {
        nn += 1;
        sum += diff;
        ss += diff * diff;
      }
    }
    const tvalue = -Math.abs(sum * Math.sqrt((nn - 1) / (nn * ss - sum * sum)));
    try {
      return (2 * new dist.Studentt(nn - 1).cdf(tvalue)).toFixed(6);
    } catch (error) {
      return NaN;
    }
  }

  render() {
    if (this.props.metrics > 1) {
      return (
        <h4 className="nvd3-paired-ttest-table">
          <div className="message-outline">
            Paired t-test values do not apply across multiple metrics
          </div>
        </h4>);
    }

    return (
      <div className="nvd3-paired-ttest-table">
        <Table className="table-container" bordered condensed hover>
          <thead>
            <tr>
              <th>Dimensions</th>
              <th>Paired t-test value</th>
              <th>Lift %</th>
            </tr>
          </thead>
          <tbody>
            {this.state.table.map((row, i) => (
              <tr onClick={() => { this.pairedTTestQuery(i); }} className={row.highlight ? 'highlight' : ''} key={i}>
                <td>
                  {row.stream}
                </td>
                <td className={this.getTTestValueClass(row.pval)}>
                  {row.pval}  {this.getTTestValueClass(row.pval) === 'color-red' ? '(not significant)' : ''}
                </td>
                <td className={this.getLiftClass(row.lift)}>
                  {row.lift}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

    );
  }
}
PairedTTestTableContainer.propTypes = propTypes;

function mapStateToProps(state) {
  return {
    viz_type: state.latestQueryFormData.viz_type,
    metrics: state.latestQueryFormData.metrics.length,
    queryResponse: state.queryResponse,
  };
}

export default connect(mapStateToProps, () => ({}))(PairedTTestTableContainer);
