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
import { Table, Tr, Td, unsafe } from 'reactable-arc';
import { SupersetClient } from '@superset-ui/connection';

import withToasts from '../messageToasts/enhancers/withToasts';
import CardTable from '../components/CardTable';
import DashboardCard from '../components/DashboardCard';
import '../../stylesheets/reactable-pagination.css';

const propTypes = {
  showTable: PropTypes.bool,
  addDangerToast: PropTypes.func.isRequired,
};

const CARD_WIDTH = 250;

class DashboardCardTable extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      search: '',
      dashboards: null,
      loading: true,
      filteredDashboards: null,
    };
    this.renderTable = this.renderTable.bind(this);
    this.onSearchChange = this.onSearchChange.bind(this);
    this.onDelete = this.onDelete.bind(this);
    this.renderCards = this.renderCards.bind(this);
    this.deleteDashboard = this.deleteDashboard.bind(this);
  }
  componentDidMount() {
    const endpoint = (
      '/dashboardasync/api/read?' +
      '_oc_DashboardModelViewAsync=changed_on' +
      '&_od_DashboardModelViewAsync=desc'
    );
    SupersetClient.get({ endpoint })
      .then(({ json }) => {
        const dashboards = json.result;
        this.setState({
          dashboards,
          loading: false,
          filteredDashboards: dashboards,
        });
      })
      .catch(() => {
        this.props.addDangerToast(t('An error occurred while fetching data'));
        this.setState({ dashboards: null, loading: false });
      });
  }
  onSearchChange(search) {
    const filteredDashboards = this.filterDashboards(search);
    this.setState({ search, filteredDashboards });
  }
  onDelete(dashboard) {
    const filter = o => o.id !== dashboard.id;
    const dashboards = this.state.dashboards.filter(filter);
    const filteredDashboards =  this.state.filteredDashboards.filter(filter);
    this.setState({ dashboards, filteredDashboards });
  }
  deleteDashboard(dashboard) {
    const endpoint = `/dashboard/api/delete/${dashboard.id}`;
    SupersetClient.delete({ endpoint })
      .then(({ json }) => {
        this.onDelete(dashboard);
      })
      .catch(() => {
        this.props.addDangerToast(t('An error occurred while deleting the dashboard'));
      });
  }
  filterDashboards(searchText) {
    const { dashboards } = this.state;
    if (!searchText) {
      return dashboards;
    }
    const lcaseSearchText = searchText.toLowerCase();
    return dashboards.filter(o => o.dashboard_title.toLowerCase().indexOf(lcaseSearchText) >= 0);
  }
  renderTable() {
    return (
      <Table
        className="table"
        sortable={['dashboard', 'creator', 'modified']}
        itemsPerPage={50}
        hideFilterInput
        columns={[
          { key: 'dashboard', label: t('Dashboard') },
          { key: 'creator', label: t('Created by') },
          { key: 'modified', label: t('Modified') },
        ]}
        defaultSort={{ column: 'modified', direction: 'desc' }}
      >
        {this.state.filteredDashboards.map(o => (
          <Tr key={o.id}>
            <Td column="dashboard" value={o.dashboard_title} className="td-thumb">
              <a href={o.url}>
                <img src={o.thumbnail_url} alt="" />
                <span className="float-left">{o.dashboard_title}</span>
              </a>
            </Td>
            <Td column="creator" value={o.changed_by_name}>
              {unsafe(o.creator)}
            </Td>
            <Td column="modified" value={o.changed_on} className="text-muted">
              {unsafe(o.modified)}
            </Td>
          </Tr>))}
      </Table>
    );
  }
  renderCards() {
    return this.state.filteredDashboards.map(dashboard => (
      <DashboardCard
        key={dashboard.id}
        dashboard={dashboard}
        onDelete={this.deleteDashboard.bind(dashboard)}
        cardWidth={CARD_WIDTH}
      />
    ));
  }

  render() {
    return (
      <CardTable
        title={t('Dashboards')}
        renderTable={this.renderTable}
        renderCards={this.renderCards}
        onSearchChange={this.onSearchChange}
        items={this.state.filteredDashboards}
        loading={this.state.loading}
        cardWidth={CARD_WIDTH}
      />
    );
  }
}

DashboardCardTable.propTypes = propTypes;
export default withToasts(DashboardCardTable);
