/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';
import moment from 'moment';
import { debounce } from 'lodash';
import ListView from 'src/components/ListView/ListView';
import withToasts from 'src/messageToasts/enhancers/withToasts';

const PAGE_SIZE = 25;

class DashboardTable extends React.PureComponent {
  static propTypes = {
    addDangerToast: PropTypes.func.isRequired,
    search: PropTypes.string,
  };

  state = {
    dashboards: [],
    dashboard_count: 0,
    loading: false,
  };

  componentDidUpdate(prevProps) {
    if (prevProps.search !== this.props.search) {
      this.fetchDataDebounced({
        pageSize: PAGE_SIZE,
        pageIndex: 0,
        sortBy: this.initialSort,
        filters: {},
      });
    }
  }

  columns = [
    {
      accessor: 'dashboard_title',
      Header: 'Dashboard',
      Cell: ({
        row: {
          original: { url, dashboard_title: dashboardTitle },
        },
      }) => <a href={url}>{dashboardTitle}</a>,
    },
    {
      accessor: 'changed_by_fk',
      Header: 'Creator',
      Cell: ({
        row: {
          original: { changed_by_name: changedByName, changedByUrl },
        },
      }) => <a href={changedByUrl}>{changedByName}</a>,
    },
    {
      accessor: 'changed_on',
      Header: 'Modified',
      Cell: ({
        row: {
          original: { changed_on: changedOn },
        },
      }) => <span className="no-wrap">{moment(changedOn).fromNow()}</span>,
    },
  ];

  initialSort = [{ id: 'changed_on', desc: true }];

  fetchData = ({ pageIndex, pageSize, sortBy, filters }) => {
    this.setState({ loading: true });
    const filterExps = Object.keys(filters)
      .map(fk => ({
        col: fk,
        opr: filters[fk].filterId,
        value: filters[fk].filterValue,
      }))
      .concat(
        this.props.search
          ? [
              {
                col: 'dashboard_title',
                opr: 'ct',
                value: this.props.search,
              },
            ]
          : [],
      );

    const queryParams = JSON.stringify({
      order_column: sortBy[0].id,
      order_direction: sortBy[0].desc ? 'desc' : 'asc',
      page: pageIndex,
      page_size: pageSize,
      ...(filterExps.length ? { filters: filterExps } : {}),
    });

    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=${queryParams}`,
    })
      .then(({ json }) => {
        this.setState({ dashboards: json.result, dashboard_count: json.count });
      })
      .catch(response => {
        if (response.status === 401) {
          this.props.addDangerToast(
            t(
              "You don't have the necessary permissions to load dashboards. Please contact your administrator.",
            ),
          );
        } else {
          this.props.addDangerToast(
            t('An error occurred while fetching Dashboards'),
          );
        }
      })
      .finally(() => this.setState({ loading: false }));
  };

  fetchDataDebounced = debounce(this.fetchData, 200);

  render() {
    return (
      <ListView
        columns={this.columns}
        data={this.state.dashboards}
        count={this.state.dashboard_count}
        pageSize={PAGE_SIZE}
        fetchData={this.fetchData}
        loading={this.state.loading}
        initialSort={this.initialSort}
      />
    );
  }
}

export default withToasts(DashboardTable);
