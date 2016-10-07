import React from 'react';
import SelectArray from './SelectArray';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { timestampOptions, rowLimitOptions } from '../constants';
import { getSelectOptions } from '../../../utils/common';

const propTypes = {
  actions: React.PropTypes.object,
  timeStampFormat: React.PropTypes.string,
  rowLimit: React.PropTypes.number,
};

const defaultProps = {
  timeStampFormat: null,
  rowLimit: null,
};

const Options = (props) => {
  const selects = [
    {
      key: 'timeStampFormat',
      title: 'Timestamp Format',
      options: getSelectOptions(timestampOptions),
      value: props.timeStampFormat,
      width: '12',
    },
    {
      key: 'rowLimit',
      title: 'Row Limit',
      options: getSelectOptions(rowLimitOptions),
      value: props.rowLimit,
      width: '12',
    }];
  return (
    <div className="panel">
      <div className="panel-header">Options</div>
      <div className="panel-body">
        <SelectArray selectArray={selects} />
      </div>
    </div>
  );
};

Options.propTypes = propTypes;
Options.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    timeStampFormat: state.viz.formData.timeStampFormat,
    rowLimit: state.viz.formData.rowLimit,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Options);
