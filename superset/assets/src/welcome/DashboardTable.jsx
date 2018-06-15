/* eslint no-unused-vars: 0 */
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { Table, Tr, Td, Thead, Th, unsafe } from 'reactable';

import '../../stylesheets/reactable-pagination.css';

const $ = window.$ = require('jquery');

const propTypes = {
  search: PropTypes.string,
};

export default class DashboardTable extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      dashboards: false,
    };
  }
  componentDidMount() {
    const url = (
      '/dashboardmodelviewasync/api/read' +
      '?_oc_DashboardModelViewAsync=changed_on' +
      '&_od_DashboardModelViewAsync=desc');
    $.getJSON(url, (data) => {
      this.setState({ dashboards: data.result });
    });
  }
  render() {
    if (this.state.dashboards) {
      return (
        <Table
          className="table"
          sortable={['dashboard', 'creator', 'modified']}
          filterBy={this.props.search}
          filterable={['dashboard', 'creator']}
          itemsPerPage={50}
          hideFilterInput
          columns={[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'creator', label: 'Creator' },
            { key: 'modified', label: 'Modified' },
          ]}
          defaultSort={{ column: 'modified', direction: 'desc' }}
        >
          {this.state.dashboards.map(o => (
            <Tr key={o.id}>
              <Td column="dashboard" value={o.dashboard_title}>
                <a href={o.url}>{o.dashboard_title}</a>
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
    return (
      <img
        className="loading"
        alt="Loading..."
        src="/static/assets/images/loading.gif"
      />);
  }
}
DashboardTable.propTypes = propTypes;
