const $ = window.$ = require('jquery');
import React from 'react';

import { Button } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Select from 'react-select';
import * as Actions from '../actions';

class QuerySearchBar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      databaseLoading: false,
      databaseOptions: [],
      userLoading: false,
      userOptions: [],
      databaseId: null,
      userId: null,
      searchText: null,
      sql: null,
      queryState: 1,
    };
  }
  componentWillMount() {
    this.fetchDatabaseOptions();
    this.fetchUsers();
  }
  changeDb(db) {
    const val = (db) ? db.value : null;
    this.setState({ databaseId: val });
  }
  changeUser(user) {
    const val = (user) ? user.value : null;
    this.setState({ userId: val });
  }
  changeStatus(status) {
    const val = (status) ? status.value : null;
    this.setState({ queryState: val });
  }
  fetchDatabaseOptions() {
    this.setState({ databaseLoading: true });
    const url = '/databaseasync/api/read?_flt_0_expose_in_sqllab=1';
    $.get(url, (data) => {
      const options = data.result.map((db) => ({ value: db.id, label: db.database_name }));
      this.props.actions.setFilterDatabases(data.result);
      this.setState({ databaseOptions: options });
      this.setState({ databaseLoading: false });
    });
  }
  fetchUsers() {
    this.setState({ userLoading: true });
    const url = '/caravel/get_all_users';
    $.getJSON(url, (data, status) => {
      if (status === 'success') {
        const options = data.map((user) => ({ value: user[0], label: user[1] }));
        this.setState({ userLoading: false });
        this.setState({ userOptions: options });
      } else {
        console.log('get users failed');
      }
    });
  }
  changeSearch(event) {
    this.setState({ searchText: event.target.value });
  }
  search() {
    const newQueryFilter = {
      userId: this.state.userId,
      queryDbId: this.state.databaseId,
      searchText: this.state.searchText,
      queryState: this.state.queryState,
    };
    this.props.actions.setQueryFilter(newQueryFilter);
  }
  render() {
    return (
      <div>
        <div className="col-sm-2">
          <Select
            name="select-user"
            placeholder="[User]"
            options={this.state.userOptions}
            value={this.state.userId}
            isLoading={this.state.userLoading}
            autosize={false}
            onChange={this.changeUser.bind(this)}
          />
        </div>
        <div className="col-sm-2">
          <Select
            name="select-db"
            placeholder={`Select a database (${this.state.databaseOptions.length})`}
            options={this.state.databaseOptions}
            value={this.state.databaseId}
            isLoading={this.state.databaseLoading}
            autosize={false}
            onChange={this.changeDb.bind(this)}
          />
        </div>
        <div className="col-sm-4">
          <input
            type="text"
            onChange={this.changeSearch.bind(this)}
            className="form-control input-sm"
            placeholder="Search Results"
          />
        </div>
        <div className="col-sm-2">
          <Select
            name="select-state"
            placeholder="[State]"
            options={[{ value: 1, label: 'success' },
                      { value: 2, label: 'failed' },
                      { value: 3, label: 'running' },
                      ]}
            value={this.state.queryState}
            isLoading={false}
            autosize={false}
            onChange={this.changeStatus.bind(this)}
          />
        </div>
        <Button bsSize="small" bsStyle="danger" onClick={this.search.bind(this)}>
          <i className="fa fa-bomb" /> Search
        </Button>
      </div>
    );
  }
}

QuerySearchBar.propTypes = {
  actions: React.PropTypes.object,
};
QuerySearchBar.defaultProps = {
};

function mapStateToProps() {
  return {};
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(QuerySearchBar);
