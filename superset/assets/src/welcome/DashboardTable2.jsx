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
import ListView from 'src/components/ListView/ListView';
import withToasts from 'src/messageToasts/enhancers/withToasts';

class DashboardTable extends React.PureComponent {
  static propTypes = {
    addDangerToast: PropTypes.func.isRequired,
  };

  state = {
    dashboards: [],
    dashboard_count: 0,
  };

  columns = [
    {
      accessor: 'dashboard_title',
      id: 'dashboard_title',
      Header: 'Dashboard',
      filterable: true,
      Cell: ({
        row: {
          original: { url, dashboard_title },
        },
      }) => <a href={url}>{dashboard_title}</a>,
    },
    {
      accessor: 'changed_by_fk',
      id: 'changed_by_fk',
      Header: 'Creator',
      Cell: ({
        row: {
          original: { changed_by_name, changed_by_url },
        },
      }) => <a href={changed_by_url}>{changed_by_name}</a>,
    },
    {
      accessor: 'changed_on',
      id: 'changed_on',
      Header: 'Modified',
      Cell: ({
        row: {
          original: { changed_on },
        },
      }) => <span className="no-wrap">{moment(changed_on).fromNow()}</span>,
    },
  ];

  fetchData = ({ pageIndex, pageSize, sortBy, filters }) => {
    this.setState({ loading: true });
    const filterExps = Object.keys(filters).map(
      fk =>
        `(col:${fk},opr:${filters[fk].filterId},value:${filters[fk].filterValue})`,
    );
    const queryParams = [
      `order_column:${sortBy[0].id},order_direction:${
        sortBy[0].desc ? 'desc' : 'asc'
      }`,
      `page:${pageIndex},page_size:${pageSize}`,
      filterExps.length ? `filters:!(${filterExps.join(',')})` : 'filters:!()',
    ].join(',');
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=(${queryParams})`,
    })
      .then(({ json }) => {
        this.setState({ dashboards: json.result, dashboard_count: json.count });
      })
      .catch(() => {
        this.props.addDangerToast(
          t('An error occurred while fetching Dashboards'),
        );
      })
      .finally(() => this.setState({ loading: false }));
  };

  render() {
    return (
      <ListView
        title={'Dashboards'}
        columns={this.columns}
        data={this.state.dashboards}
        count={this.state.dashboard_count}
        fetchData={this.fetchData}
        loading={this.state.loading}
        defaultSort={[{ id: 'changed_on', desc: true }]}
        filterable
        filterTypes={[
          { label: 'Starts With', value: 'sw' },
          { label: 'Ends With', value: 'ew' },
          { label: 'Contains', value: 'ct' },
          { label: 'Equal To', value: 'eq' },
          { label: 'Not Starts With', value: 'nsw' },
          { label: 'Not Ends With', value: 'new' },
          { label: 'Not Contains', value: 'nct' },
          { label: 'Not Equal To', value: 'neq' },
        ]}
      />
    );
  }
}

export default withToasts(DashboardTable);
