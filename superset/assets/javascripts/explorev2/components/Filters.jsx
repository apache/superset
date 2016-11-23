import React from 'react';
// import { Tab, Row, Col, Nav, NavItem } from 'react-bootstrap';
import Filter from './Filter';
import { Button } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import shortid from 'shortid';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  filterColumnOpts: React.PropTypes.array,
  filters: React.PropTypes.array,
  prefix: React.PropTypes.string,
};

const defaultProps = {
  filterColumnOpts: [],
  filters: [],
  prefix: 'flt',
};

class Filters extends React.Component {
  addFilter() {
    this.props.actions.addFilter({
      id: shortid.generate(),
      prefix: this.props.prefix,
      col: null,
      op: null,
      value: null,
    });
  }
  render() {
    const filters = [];
    this.props.filters.forEach((filter) => {
      // only display filters with current prefix
      if (filter.prefix === this.props.prefix) {
        filters.push(
          <Filter
            filterColumnOpts={this.props.filterColumnOpts}
            actions={this.props.actions}
            prefix={this.props.prefix}
            filter={filter}
          />
        );
      }
    });
    return (
      <div>
        {filters}
        <div className="row space-2">
          <div className="col-lg-2">
            <Button
              bsSize="sm"
              onClick={this.addFilter.bind(this)}
            >
              <i className="fa fa-plus" /> &nbsp; Add Filter
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

Filters.propTypes = propTypes;
Filters.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    filterColumnOpts: state.filterColumnOpts,
    filters: state.viz.form_data.filters,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Filters);
