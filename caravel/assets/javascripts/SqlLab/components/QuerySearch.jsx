import React from 'react';
import Select from 'react-select';
import { Button } from 'react-bootstrap';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import QueryTable from './QueryTable';

class QuerySearch extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      queryText: '',
    };
  }
  changeQueryText(value) {
    this.setState({ queryText: value });
  }
  render() {
    const queries = this.props.queries;
    return (
      <div>
        <div className="pane-cell pane-west m-t-5">
          <div className="panel panel-default Workspace">
            <div className="panel-heading">
              <h6>
                <i className="fa fa-search" /> Search Queries
              </h6>
            </div>
            <div className="panel-body">
              <input type="text" className="form-control" placeholder="Query Text" />
              <Select
                name="select-user"
                placeholder="[User]"
                options={['maxime_beauchemin', 'someone else']}
                value={'maxime_beauchemin'}
                className="m-t-10"
                autosize={false}
              />
            </div>
          </div>
        </div>
        <div className="pane-cell">
          <QueryTable
            columns={['state', 'started', 'duration', 'rows', 'sql', 'actions']}
            queries={queries}
          />
        </div>
        <Button>Search!</Button>
      </div>
    );
  }
}
QuerySearch.propTypes = {
  queries: React.PropTypes.array,
};
QuerySearch.defaultProps = {
  queries: [],
};

function mapStateToProps(state) {
  return {
    queries: state.queries,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(QuerySearch);
