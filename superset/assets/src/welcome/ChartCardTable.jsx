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
import ChartCard from '../components/ChartCard';
import '../../stylesheets/reactable-pagination.css';

const propTypes = {
  showTable: PropTypes.bool,
  addDangerToast: PropTypes.func.isRequired,
};

const CHART_WIDTH = 250;

class ChartCardTable extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      search: '',
      loading: true,
      charts: null,
      filteredCharts: null,
    };
    this.renderTable = this.renderTable.bind(this);
    this.onSearchChange = this.onSearchChange.bind(this);
    this.renderCards = this.renderCards.bind(this);
    this.deleteChart = this.deleteChart.bind(this);
  }
  componentDidMount() {
    const endpoint = (
      '/sliceasync/api/read?' +
      '_oc_ChartModelViewAsync=changed_on' +
      '&_od_ChartModelViewAsync=desc'
    );
    SupersetClient.get({ endpoint })
      .then(({ json }) => {
        const charts = json.result;
        this.setState({
          charts,
          loading: false,
          filteredCharts: charts,
        });
      })
      .catch(() => {
        this.props.addDangerToast(t('An error occurred while fetching data'));
        this.setState({ charts: null, loading: false });
      });
  }
  deleteChart(chart) {
    const endpoint = `/chart/api/delete/${chart.id}`;
    SupersetClient.delete({ endpoint })
      .then(({ json }) => {
        this.removeChart(chart);
      })
      .catch(() => {
        this.props.addDangerToast(t('An error occurred while deleting the chart'));
      });
  }
  onSearchChange(search) {
    const filteredCharts = this.filterCharts(search);
    this.setState({ search, filteredCharts });
  }
  removeChart(chart) {
    const filter = o => o.id !== chart.id;
    const charts = this.state.charts.filter(filter);
    const filteredCharts =  this.state.filteredCharts.filter(filter);
    this.setState({ charts, filteredCharts });
  }
  getDatasourceName(chart) {
    const o = chart.datasource_data_summary;
    return o.schema ? `${o.schema}.${o.datasource_name}` : o.datasource_name;
  }
  filterCharts(searchText) {
    const { charts } = this.state;
    if (!searchText) {
      return charts;
    }
    const lcaseSearchText = searchText.toLowerCase();
    return charts.filter(o => o.slice_name.toLowerCase().indexOf(lcaseSearchText) >= 0);
  }
  renderDatasourceLink(chart) {
    const o = chart.datasource_data_summary;
    const url = o.explore_url;
    const name = this.getDatasourceName(chart);
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" >{name}</a>
    );
  }
  renderTable() {
    const { filteredCharts } = this.state;
    return (
      <Table
        className="table"
        sortable={['chart', 'datasource', 'creator', 'modified']}
        filterable={['chart', 'creator']}
        itemsPerPage={50}
        hideFilterInput
        columns={[
          { key: 'chart', label: t('Chart') },
          { key: 'datasource', label: t('Datasource') },
          { key: 'creator', label: t('Created by') },
          { key: 'modified', label: t('Modified') },
        ]}
        defaultSort={{ column: 'modified', direction: 'desc' }}
      >
        {filteredCharts.map(o => (
          <Tr key={o.id}>
            <Td column="chart" value={o.slice_name} className="td-thumb">
              <a href={o.slice_url} target="_blank" rel="noopener noreferrer">
                <img src={o.thumbnail_url} alt="" />
                <span className="float-left">{o.slice_name}</span>
              </a>
            </Td>
            <Td column="datasource" value={this.getDatasourceName(o)}>
              {this.renderDatasourceLink(o)}
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
    return this.state.filteredCharts.map(chart => (
      <ChartCard
        key={chart.id}
        chart={chart}
        onDelete={this.deleteChart}
        cardWidth={CHART_WIDTH}
      />
    ));
  }

  render() {
    return (
      <CardTable
        title={t('Charts')}
        renderTable={this.renderTable}
        renderCards={this.renderCards}
        onSearchChange={this.onSearchChange}
        filterItems={this.filterCharts}
        items={this.state.filteredCharts}
        loading={this.state.loading}
        cardWidth={CHART_WIDTH}
      />
    );
  }
}

ChartCardTable.propTypes = propTypes;
export default withToasts(ChartCardTable);
