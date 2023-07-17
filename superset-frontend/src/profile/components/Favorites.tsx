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
import rison from 'rison';
import moment from 'moment';
import { t } from '@superset-ui/core';
import { DashboardResponse, BootstrapUser } from 'src/types/bootstrapTypes';
import TableLoader from '../../components/TableLoader';
import { Chart } from '../types';

interface FavoritesProps {
  user: BootstrapUser;
}

export default class Favorites extends React.PureComponent<FavoritesProps> {
  renderSliceTable() {
    const mutator = (payload: { result: Chart[] }) =>
      payload.result.map(slice => ({
        slice: <a href={slice.slice_url}>{slice.slice_name}</a>,
        creator: <a href={slice.created_by_url}>{slice.created_by_name}</a>,
        favorited: moment.utc(slice.changed_on_dttm).fromNow(),
        _favorited: slice.changed_on_dttm,
      }));

    const query = rison.encode({
      filters: [
        {
          col: 'id',
          opr: 'chart_is_favorite',
          value: true,
        },
      ],
      order_column: 'slice_name',
      order_direction: 'asc',
      page: 0,
      page_size: 25,
    });

    return (
      <TableLoader
        dataEndpoint={`/api/v1/chart/?q=${query}`}
        className="table-condensed"
        columns={['slice', 'creator', 'favorited']}
        mutator={mutator}
        noDataText={t('No favorite charts yet, go click on stars!')}
        sortable
      />
    );
  }

  renderDashboardTable() {
    const search = [{ col: 'id', opr: 'dashboard_is_favorite', value: true }];
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
        noDataText={t('No favorite dashboards yet, go click on stars!')}
        columns={['dashboard', 'creator', 'created']}
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
