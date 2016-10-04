import React from 'react';
import Select from 'react-select';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { timestampOptions, rowLimitOptions } from '../constants';

const propTypes = {
  actions: React.PropTypes.object,
  timeStampFormat: React.PropTypes.string,
  rowLimit: React.PropTypes.number,
};

const defaultProps = {
  timeStampFormat: null,
  rowLimit: null,
};

class Options extends React.Component {
  changeTimeStampFormat(timeStampFormat) {
    const val = (timeStampFormat) ? timeStampFormat.value : null;
    this.props.actions.setTimeStampFormat(val);
  }
  changeRowLimit(rowLimit) {
    this.props.actions.setRowLimit(rowLimit);
  }
  render() {
    return (
      <div className="panel space-1">
        <div className="panel-header">Options</div>
        <div className="panel-body">
          <div className="row">
            <h5 className="section-heading">Table Timestamp Format</h5>
            <Select
              name="select-timestamp-format"
              placeholder="Select timestamp format"
              options={timestampOptions.map((t) => ({ value: t[0], label: t[1] }))}
              value={this.props.timeStampFormat}
              autosize={false}
              onChange={this.changeTimeStampFormat.bind(this)}
            />
          </div>
          <div className="row">
            <h5 className="section-heading">Row Limit</h5>
            <Select
              name="select-row-limit"
              placeholder="Select row limit"
              options={rowLimitOptions.map((r) => ({ value: r, label: r }))}
              value={this.props.rowLimit}
              autosize={false}
              onChange={this.changeRowLimit.bind(this)}
            />
          </div>
        </div>
      </div>
    );
  }
}

Options.propTypes = propTypes;
Options.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    timeStampFormat: state.timeStampFormat,
    rowLimit: state.rowLimit,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Options);
