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
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';
import withToasts from '../messageToasts/enhancers/withToasts';
import ListView from 'src/components/ListView/ListView';

const propTypes = {
  addDangerToast: PropTypes.func.isRequired,
};

class DashboardTable extends React.PureComponent {
  state = {
    dashboards: [],
    dashboard_count: 0,
  };

  columns = [
    {
      accessor: 'dashboard_title',
      Header: 'Dashboard',
      id: 'dashboard_title',
      filterable: true,
      Cell: ({
        row: {
          original: { dashboard_link },
        },
      }) => <span dangerouslySetInnerHTML={{ __html: dashboard_link }} />,
    },
    {
      accessor: 'changed_by_name',
      Header: 'Creator',
      id: 'changed_by_fk',
      Cell: ({
        row: {
          original: { creator },
        },
      }) => <span dangerouslySetInnerHTML={{ __html: creator }} />,
    },
    {
      accessor: row => new Date(row.changed_on),
      Header: 'Modified',
      id: 'changed_on',
      Cell: ({
        row: {
          original: { modified },
        },
      }) => <span dangerouslySetInnerHTML={{ __html: modified }} />,
    },
  ];

  fetchData = ({ pageIndex, pageSize, sortBy, filters }) => {
    this.setState({ loading: true });
    const filterExps = Object.keys(filters).map(
      fk => `&_flt_${filters[fk].filterId}_${fk}=${filters[fk].filterValue}`,
    );
    return SupersetClient.get({
      endpoint: [
        '/dashboardasync/api/read',
        `?_oc_DashboardModelViewAsync=${
          sortBy[0].id
        }&_od_DashboardModelViewAsync=${sortBy[0].desc ? 'desc' : 'asc'}`,
        `&_psize_DashboardModelViewAsync=${pageSize}&_page_DashboardModelViewAsync=${pageIndex}`,
        ...filterExps,
      ].join(''),
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
      />
    );
  }
}

DashboardTable.propTypes = propTypes;

export default withToasts(DashboardTable);
