import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import Select from 'react-select';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import Loading from '../../components/Loading';
import QueryTable from './QueryTable';
import {
  now,
  epochTimeXHoursAgo,
  epochTimeXDaysAgo,
  epochTimeXYearsAgo,
} from '../../modules/dates';
import { STATUS_OPTIONS, TIME_OPTIONS } from '../constants';
import AsyncSelect from '../../components/AsyncSelect';

const propTypes = {
  actions: PropTypes.object.isRequired,
  height: PropTypes.string.isRequired,
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
      from: '28 days ago',
      to: 'now',
      status: 'success',
      queriesArray: [],
      queriesLoading: true,
    };
    this.userMutator = this.userMutator.bind(this);
    this.changeUser = this.changeUser.bind(this);
    this.dbMutator = this.dbMutator.bind(this);
    this.onChange = this.onChange.bind(this);
    this.changeSearch = this.changeSearch.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.changeFrom = this.changeFrom.bind(this);
    this.changeTo = this.changeTo.bind(this);
    this.changeStatus = this.changeStatus.bind(this);
    this.refreshQueries = this.refreshQueries.bind(this);
    this.onUserClicked = this.onUserClicked.bind(this);
    this.onDbClicked = this.onDbClicked.bind(this);
  }

  componentDidMount() {
    this.refreshQueries();
  }

  onUserClicked(userId) {
    this.setState({ userId }, () => {
      this.refreshQueries();
    });
  }

  onDbClicked(dbId) {
    this.setState({ databaseId: dbId }, () => {
      this.refreshQueries();
    });
  }

  onChange(db) {
    const val = db ? db.value : null;
    this.setState({ databaseId: val });
  }

  onKeyDown(event) {
    if (event.keyCode === 13) {
      this.refreshQueries();
    }
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
    const val = user ? user.value : null;
    this.setState({ from: val });
  }

  changeTo(status) {
    const val = status ? status.value : null;
    this.setState({ to: val });
  }

  changeUser(user) {
    const val = user ? user.value : null;
    this.setState({ userId: val });
  }

  insertParams(baseUrl, params) {
    const validParams = params.filter(function (p) {
      return p !== '';
    });
    return baseUrl + '?' + validParams.join('&');
  }

  changeStatus(status) {
    const val = status ? status.value : null;
    this.setState({ status: val });
  }

  changeSearch(event) {
    this.setState({ searchText: event.target.value });
  }

  userLabel(user) {
    if (user.first_name && user.last_name) {
      return user.first_name + ' ' + user.last_name;
    }
    return user.username;
  }

  userMutator(data) {
    const options = [];
    for (let i = 0; i < data.pks.length; i++) {
      options.push({ value: data.pks[i], label: this.userLabel(data.result[i]) });
    }
    return options;
  }

  dbMutator(data) {
    const options = data.result.map(db => ({ value: db.id, label: db.database_name }));
    this.props.actions.setDatabases(data.result);
    if (data.result.length === 0) {
      this.props.actions.addDangerToast(t("It seems you don't have access to any database"));
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

    SupersetClient.get({ endpoint: this.insertParams('/superset/search_queries', params) })
      .then(({ json }) => {
        this.setState({ queriesArray: json, queriesLoading: false });
      })
      .catch(() => {
        this.props.actions.addDangerToast(t('An error occurred when refreshing queries'));
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
              onChange={this.changeUser}
              placeholder={t('Filter by user')}
            />
          </div>
          <div className="col-sm-2">
            <AsyncSelect
              onChange={this.onChange}
              dataEndpoint="/databaseasync/api/read?_flt_0_expose_in_sqllab=1"
              value={this.state.databaseId}
              mutator={this.dbMutator}
              placeholder={t('Filter by database')}
            />
          </div>
          <div className="col-sm-4">
            <input
              type="text"
              onChange={this.changeSearch}
              onKeyDown={this.onKeyDown}
              className="form-control input-sm"
              placeholder={t('Query search string')}
            />
          </div>
          <div className="col-sm-4 search-date-filter-container">
            <Select
              name="select-from"
              placeholder={t('[From]-')}
              options={TIME_OPTIONS.slice(1, TIME_OPTIONS.length).map(xt => ({
                value: xt,
                label: xt,
              }))}
              value={this.state.from}
              autosize={false}
              onChange={this.changeFrom}
            />

            <Select
              name="select-to"
              placeholder={t('[To]-')}
              options={TIME_OPTIONS.map(xt => ({ value: xt, label: xt }))}
              value={this.state.to}
              autosize={false}
              onChange={this.changeTo}
            />

            <Select
              name="select-status"
              placeholder={t('Filter by status')}
              options={Object.keys(STATUS_OPTIONS).map(s => ({ value: s, label: s }))}
              value={this.state.status}
              isLoading={false}
              autosize={false}
              onChange={this.changeStatus}
            />

            <Button bsSize="small" bsStyle="success" onClick={this.refreshQueries}>
              {t('Search')}
            </Button>
          </div>
        </div>
        <div className="scrollbar-container">
          {this.state.queriesLoading ? (
            <Loading />
          ) : (
            <div className="scrollbar-content" style={{ height: this.props.height }}>
              <QueryTable
                columns={['state', 'db', 'user', 'time', 'progress', 'rows', 'sql', 'querylink']}
                onUserClicked={this.onUserClicked}
                onDbClicked={this.onDbClicked}
                queries={this.state.queriesArray}
                actions={this.props.actions}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}
QuerySearch.propTypes = propTypes;
export default QuerySearch;
