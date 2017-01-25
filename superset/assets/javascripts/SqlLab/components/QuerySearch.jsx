const $ = window.$ = require('jquery');
import React from 'react';
import { Button } from 'react-bootstrap';
import Select from 'react-select';
import QueryTable from './QueryTable';
import { now, epochTimeXHoursAgo,
  epochTimeXDaysAgo, epochTimeXYearsAgo } from '../../modules/dates';
import { STATUS_OPTIONS, TIME_OPTIONS } from '../constants';
import AsyncSelect from '../../components/AsyncSelect';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
};

class QuerySearch extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      userLoading: false,
      userOptions: [],
      databaseId: null,
      userId: null,
      searchText: null,
      from: null,
      to: null,
      status: 'success',
      queriesArray: [],
      queriesLoading: true,
    };
  }
  componentDidMount() {
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
  getTimeFromSelection(selection) {
    switch (selection) {
      case 'now':
        return now();
      case '1 hour ago':
        return epochTimeXHoursAgo(1);
      case '1 day ago':
        return epochTimeXDaysAgo(1);
      case '7 days ago':
        return epochTimeXDaysAgo(7);
      case '28 days ago':
        return epochTimeXDaysAgo(28);
      case '90 days ago':
        return epochTimeXDaysAgo(90);
      case '1 year ago':
        return epochTimeXYearsAgo(1);
      default:
        return null;
    }
  }
  changeFrom(user) {
    const val = (user) ? user.value : null;
    this.setState({ from: val });
  }
  changeTo(status) {
    const val = (status) ? status.value : null;
    this.setState({ to: val });
  }
  changeUser(user) {
    const val = (user) ? user.value : null;
    this.setState({ userId: val });
  }
  insertParams(baseUrl, params) {
    const validParams = params.filter(
      function (p) { return p !== ''; }
    );
    return baseUrl + '?' + validParams.join('&');
  }
  changeStatus(status) {
    const val = (status) ? status.value : null;
    this.setState({ status: val });
  }
  changeSearch(event) {
    this.setState({ searchText: event.target.value });
  }
  userMutator(data) {
    const options = [];
    for (let i = 0; i < data.pks.length; i++) {
      options.push({ value: data.pks[i], label: data.result[i].username });
    }
    return options;
  }
  dbMutator(data) {
    const options = data.result.map((db) => ({ value: db.id, label: db.database_name }));
    this.props.actions.setDatabases(data.result);
    if (data.result.length === 0) {
      this.props.actions.addAlert({
        bsStyle: 'danger',
        msg: "It seems you don't have access to any database",
      });
    }
    return options;
  }
  refreshQueries() {
    this.setState({ queriesLoading: true });
    const params = [
      this.state.userId ? `user_id=${this.state.userId}` : '',
      this.state.databaseId ? `database_id=${this.state.databaseId}` : '',
      this.state.searchText ? `search_text=${this.state.searchText}` : '',
      this.state.status ? `status=${this.state.status}` : '',
      this.state.from ? `from=${this.getTimeFromSelection(this.state.from)}` : '',
      this.state.to ? `to=${this.getTimeFromSelection(this.state.to)}` : '',
    ];

    const url = this.insertParams('/superset/search_queries', params);
    $.getJSON(url, (data, status) => {
      if (status === 'success') {
        this.setState({ queriesArray: data, queriesLoading: false });
      }
    });
  }
  render() {
    return (
      <div>
        <div id="search-header" className="row space-1">
          <div className="col-sm-2">
            <AsyncSelect
              dataEndpoint="/users/api/read"
              mutator={this.userMutator}
              value={this.state.userId}
              onChange={this.changeUser.bind(this)}
            />
          </div>
          <div className="col-sm-2">
            <AsyncSelect
              onChange={this.onChange.bind(this)}
              dataEndpoint="/databaseasync/api/read?_flt_0_expose_in_sqllab=1"
              value={this.state.databaseId}
              mutator={this.dbMutator.bind(this)}
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
          <div className="col-sm-1">
            <Select
              name="select-from"
              placeholder="[From]-"
              options={TIME_OPTIONS.
                slice(1, TIME_OPTIONS.length).map((t) => ({ value: t, label: t }))}
              value={this.state.from}
              autosize={false}
              onChange={this.changeFrom.bind(this)}
            />
          </div>
          <div className="col-sm-1">
            <Select
              name="select-to"
              placeholder="[To]-"
              options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
              value={this.state.to}
              autosize={false}
              onChange={this.changeTo.bind(this)}
            />
          </div>
          <div className="col-sm-1">
            <Select
              name="select-status"
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
        {this.state.queriesLoading ?
          (<img className="loading" alt="Loading..." src="/static/assets/images/loading.gif" />)
          :
          (
          <div
            style={{ height: this.props.height }}
            className="scrollbar-container"
          >
            <div className="scrollbar-content">
              <QueryTable
                columns={[
                  'state', 'db', 'user', 'time',
                  'progress', 'rows', 'sql', 'querylink',
                ]}
                onUserClicked={this.onUserClicked.bind(this)}
                onDbClicked={this.onDbClicked.bind(this)}
                queries={this.state.queriesArray}
                actions={this.props.actions}
              />
            </div>
          </div>
          )
        }
      </div>
    );
  }
}
QuerySearch.propTypes = propTypes;
export default QuerySearch;
