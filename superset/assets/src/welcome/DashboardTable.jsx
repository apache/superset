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
    search: PropTypes.string.isRequired,
  };

  state = {
    dashboards: [],
    dashboard_count: 0,
    loading: false,
  };

  columns = [
    {
      accessor: 'dashboard_title',
      // id: 'dashboard_title',
      Header: 'Dashboard',
      sortable: true,
      Cell: ({
        row: {
          original: { url, dashboard_title },
        },
      }) => <a href={url}>{dashboard_title}</a>,
    },
    {
      accessor: 'changed_by_fk',
      // id: 'changed_by_fk',
      Header: 'Creator',
      sortable: true,
      Cell: ({
        row: {
          original: { changed_by_name, changed_by_url },
        },
      }) => <a href={changed_by_url}>{changed_by_name}</a>,
    },
    {
      accessor: 'changed_on',
      // id: 'changed_on',
      Header: 'Modified',
      sortable: true,
      Cell: ({
        row: {
          original: { changed_on },
        },
      }) => <span className="no-wrap">{moment(changed_on).fromNow()}</span>,
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

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.search !== this.props.search) {
      this.fetchDataDebounced({
        pageSize: PAGE_SIZE,
        pageIndex: 0,
        sortBy: this.initialSort,
        filters: {},
      });
    }
  }

  render() {
    return (
      <ListView
        // title={'Dashboards'}
        columns={this.columns}
        data={this.state.dashboards}
        count={this.state.dashboard_count}
        pageSize={PAGE_SIZE}
        fetchData={this.fetchData}
        loading={this.state.loading}
        initialSort={this.initialSort}

        // filterable
        // filterTypes={[
        //   { label: 'Starts With', value: 'sw' },
        //   { label: 'Ends With', value: 'ew' },
        //   { label: 'Contains', value: 'ct' },
        //   { label: 'Equal To', value: 'eq' },
        //   { label: 'Not Starts With', value: 'nsw' },
        //   { label: 'Not Ends With', value: 'new' },
        //   { label: 'Not Contains', value: 'nct' },
        //   { label: 'Not Equal To', value: 'neq' },
        // ]}
      />
    );
  }
}

export default withToasts(DashboardTable);
