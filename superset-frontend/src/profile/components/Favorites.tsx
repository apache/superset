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
import moment from 'moment';
import { t } from '@superset-ui/core';

import TableLoader from '../../components/TableLoader';
import { Slice } from '../types';
import { User, Dashboard } from '../../types/bootstrapTypes';

interface FavoritesProps {
  user: User;
}

export default class Favorites extends React.PureComponent<FavoritesProps> {
  renderSliceTable() {
    const mutator = (data: Slice[]) =>
      data.map(slice => ({
        slice: <a href={slice.url}>{slice.title}</a>,
        creator: <a href={slice.creator_url}>{slice.creator}</a>,
        favorited: moment.utc(slice.dttm).fromNow(),
        _favorited: slice.dttm,
      }));
    return (
      <TableLoader
        dataEndpoint={`/superset/fave_slices/${this.props.user.userId}/`}
        className="table table-condensed"
        columns={['slice', 'creator', 'favorited']}
        mutator={mutator}
        noDataText={t('No favorite charts yet, go click on stars!')}
        sortable
      />
    );
  }
  renderDashboardTable() {
    const mutator = (data: Dashboard[]) =>
      data.map(dash => ({
        dashboard: <a href={dash.url}>{dash.title}</a>,
        creator: <a href={dash.creator_url}>{dash.creator}</a>,
        favorited: moment.utc(dash.dttm).fromNow(),
      }));
    return (
      <TableLoader
        className="table table-condensed"
        mutator={mutator}
        dataEndpoint={`/superset/fave_dashboards/${this.props.user.userId}/`}
        noDataText={t('No favorite dashboards yet, go click on stars!')}
        columns={['dashboard', 'creator', 'favorited']}
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
