import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';

const propTypes = {
  actions: React.PropTypes.object,
};

class SqlClause extends React.Component {
  onChange(key, event) {
    this.props.actions.setFormData(key, event.target.value);
  }
  render() {
    return (
      <div className="panel">
        <div className="panel-header">SQL</div>
        <div className="panel-body">
          <div className="row">
            <h5 className="section-heading">Where</h5>
            <input
              type="text"
              onChange={this.onChange.bind(this, 'where')}
              className="form-control input-sm"
              placeholder="Where Clause"
            />
          </div>
          <div className="row">
            <h5 className="section-heading">Having</h5>
            <input
              type="text"
              onChange={this.onChange.bind(this, 'having')}
              className="form-control input-sm"
              placeholder="Having Clause"
            />
          </div>
        </div>
      </div>
    );
  }
}

SqlClause.propTypes = propTypes;

function mapStateToProps() {
  return {};
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SqlClause);
