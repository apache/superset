import React from 'react';
import Select from 'react-select';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';

const propTypes = {
  actions: React.PropTypes.object,
  selectArray: React.PropTypes.arrayOf(
    React.PropTypes.shape({
     key: React.PropTypes.string.isRequired,
     options: React.PropTypes.array.isRequired,
     value: React.PropTypes.string.isRequired,
    })
  ).isRequired,
};

const defaultProps = {
  selectArray: [],
};

class SelectArray extends React.Component {
  changeSelectData(field, opt) {
    const val = opt ? opt.value : null;
    this.props.actions.setStateValue(field, val);
  }
  render() {
    const selects = selectArray.map((obj) => (
      <div className="col-sm-6">
        <h5 className="section-heading">obj.key</h5>
        <Select
          name={`select-${obj.key}`}
          options={obj.options.map((o) => ({ value: o, label: o }))}
          value={obj.value}
          autosize={false}
          onChange={this.changeSelectData.bind(this, obj.key)}
        />
      </div>
    ));
    return (
      <div className="panel space-1">
        <div className="panel-body">
          {selects}
        </div>
      </div>
    );
  }
}

SelectArray.propTypes = propTypes;
SelectArray.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {};
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectArray);
