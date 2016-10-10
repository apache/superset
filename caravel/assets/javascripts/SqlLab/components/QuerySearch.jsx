const $ = window.$ = require('jquery');
import React from 'react';

import { Button } from 'react-bootstrap';
import Select from 'react-select';
import QueryTable from './QueryTable';
import DatabaseSelect from './DatabaseSelect';
import { STATUS_OPTIONS } from '../common';

class QuerySearch extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      userLoading: false,
      userOptions: [],
      databaseId: null,
      userId: null,
      searchText: null,
      status: 'success',
      queriesArray: [],
    };
  }
  componentWillMount() {
    this.fetchUsers();
    this.refreshQueries();
  }
  onUserClicked(userId) {
    this.setState({ userId }, () => { this.refreshQueries(); });
  }
  onDbClicked(dbId) {
    this.setState({ databaseId: dbId }, () => { this.refreshQueries(); });
  }
  onChange(db) {
    const val = (db) ? db.value : null;
    this.setState({ databaseId: val });
  }
  insertParams(baseUrl, params) {
    return baseUrl + '?' + params.join('&');
  }
  changeUser(user) {
    const val = (user) ? user.value : null;
    this.setState({ userId: val });
  }
  changeStatus(status) {
    const val = (status) ? status.value : null;
    this.setState({ status: val });
  }
  changeSearch(event) {
    this.setState({ searchText: event.target.value });
  }
  fetchUsers() {
    this.setState({ userLoading: true });
    const url = '/users/api/read';
    $.getJSON(url, (data, status) => {
      if (status === 'success') {
        const options = [];
        for (let i = 0; i < data.pks.length; i++) {
          options.push({ value: data.pks[i], label: data.result[i].username });
        }
        this.setState({ userOptions: options, userLoading: false });
      }
    });
  }
  refreshQueries() {
    const params = [
      `userId=${this.state.userId}`,
      `databaseId=${this.state.databaseId}`,
      `searchText=${this.state.searchText}`,
      `status=${this.state.status}`,
    ];

    const url = this.insertParams('/caravel/search_queries', params);
    $.getJSON(url, (data, status) => {
      if (status === 'success') {
        const newQueriesArray = [];
        for (const id in data) {
          newQueriesArray.push(data[id]);
        }
        this.setState({ queriesArray: newQueriesArray });
      }
    });
  }
  render() {
    return (
      <div>
        <div className="row space-1">
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
            <DatabaseSelect
              onChange={this.onChange.bind(this)}
              databaseId={this.state.databaseId}
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
              placeholder="[Query Status]"
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
              value={this.state.status}
              isLoading={false}
              autosize={false}
              onChange={this.changeStatus.bind(this)}
            />
          </div>
          <Button bsSize="small" bsStyle="success" onClick={this.refreshQueries.bind(this)}>
            Search
          </Button>
        </div>
        <QueryTable
          columns={[
            'state', 'db', 'user',
            'progress', 'rows', 'sql', 'querylink',
          ]}
          onUserClicked={this.onUserClicked.bind(this)}
          onDbClicked={this.onDbClicked.bind(this)}
          queries={this.state.queriesArray}
        />
      </div>
    );
  }
}


export default QuerySearch;
