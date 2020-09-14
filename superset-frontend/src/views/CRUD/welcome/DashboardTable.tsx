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
import { t, SupersetClient } from '@superset-ui/core';
import { debounce } from 'lodash';
import ListView, { FetchDataConfig } from 'src/components/ListView';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { Dashboard } from 'src/types/bootstrapTypes';

const PAGE_SIZE = 25;

interface DashboardTableProps {
  addDangerToast: (message: string) => void;
  search?: string;
}

interface DashboardTableState {
  dashboards: Dashboard[];
  dashboard_count: number;
  loading: boolean;
}

class DashboardTable extends React.PureComponent<
  DashboardTableProps,
  DashboardTableState
> {
  columns = [
    {
      accessor: 'dashboard_title',
      Header: 'Dashboard',
      Cell: ({
        row: {
          original: { url, dashboard_title: dashboardTitle },
        },
      }: {
        row: {
          original: {
            url: string;
            dashboard_title: string;
          };
        };
      }) => <a href={url}>{dashboardTitle}</a>,
    },
    {
      accessor: 'changed_by.first_name',
      Header: 'Modified By',
      Cell: ({
        row: {
          original: { changed_by_name: changedByName, changedByUrl },
        },
      }: {
        row: {
          original: {
            changed_by_name: string;
            changedByUrl: string;
          };
        };
      }) => <a href={changedByUrl}>{changedByName}</a>,
    },
    {
      accessor: 'changed_on_delta_humanized',
      Header: 'Modified',
      Cell: ({
        row: {
          original: { changed_on_delta_humanized: changedOn },
        },
      }: {
        row: {
          original: {
            changed_on_delta_humanized: string;
          };
        };
      }) => <span className="no-wrap">{changedOn}</span>,
    },
  ];

  initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];

  state = {
    dashboards: [],
    dashboard_count: 0,
    loading: false,
  };

  componentDidUpdate(prevProps: DashboardTableProps) {
    if (prevProps.search !== this.props.search) {
      this.fetchDataDebounced({
        pageSize: PAGE_SIZE,
        pageIndex: 0,
        sortBy: this.initialSort,
        filters: [],
      });
    }
  }

  fetchData = ({ pageIndex, pageSize, sortBy, filters }: FetchDataConfig) => {
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

  // sort-comp disabled because of conflict with no-use-before-define rule
  // eslint-disable-next-line react/sort-comp
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
