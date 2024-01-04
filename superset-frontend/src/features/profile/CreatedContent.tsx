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
import rison from 'rison';
import React from 'react';
import { t } from '@superset-ui/core';

import TableLoader from 'src/components/TableLoader';
import {
  BootstrapUser,
  ChartResponse,
  DashboardResponse,
} from 'src/types/bootstrapTypes';

interface CreatedContentProps {
  user: BootstrapUser;
}

class CreatedContent extends React.PureComponent<CreatedContentProps> {
  renderSliceTable() {
    const search = [
      { col: 'created_by', opr: 'chart_created_by_me', value: 'me' },
    ];
    const query = rison.encode({
      keys: ['none'],
      columns: ['created_on_delta_humanized', 'slice_name', 'url'],
      filters: search,
      order_column: 'changed_on_delta_humanized',
      order_direction: 'desc',
      page: 0,
      page_size: 100,
    });

    const mutator = (data: ChartResponse) =>
      data.result.map(chart => ({
        chart: <a href={chart.url}>{chart.slice_name}</a>,
        created: chart.created_on_delta_humanized,
        _created: chart.created_on_delta_humanized,
      }));
    return (
      <TableLoader
        dataEndpoint={`/api/v1/chart/?q=${query}`}
        className="table-condensed"
        columns={['chart', 'created']}
        mutator={mutator}
        noDataText={t('No charts')}
        sortable
      />
    );
  }

  renderDashboardTable() {
    const search = [
      { col: 'created_by', opr: 'dashboard_created_by_me', value: 'me' },
    ];
    const query = rison.encode({
      keys: ['none'],
      columns: ['created_on_delta_humanized', 'dashboard_title', 'url'],
      filters: search,
      order_column: 'changed_on',
      order_direction: 'desc',
      page: 0,
      page_size: 100,
    });
    const mutator = (data: DashboardResponse) =>
      data.result.map(dash => ({
        dashboard: <a href={dash.url}>{dash.dashboard_title}</a>,
        created: dash.created_on_delta_humanized,
        _created: dash.created_on_delta_humanized,
      }));
    return (
      <TableLoader
        className="table-condensed"
        mutator={mutator}
        dataEndpoint={`/api/v1/dashboard/?q=${query}`}
        noDataText={t('No dashboards')}
        columns={['dashboard', 'created']}
        sortable
      />
    );
  }

  render() {
    return (
      <div>
        <h3>{t('Dashboards')}</h3>
        {this.renderDashboardTable()}
        <hr />
        <h3>{t('Charts')}</h3>
        {this.renderSliceTable()}
      </div>
    );
  }
}

export default CreatedContent;
