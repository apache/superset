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
import { Table, Tr, Td, unsafe } from 'reactable-arc';
import { SupersetClient } from '@superset-ui/connection';
import { t } from '@superset-ui/translation';

import withToasts from '../messageToasts/enhancers/withToasts';
import Loading from '../components/Loading';
import '../../stylesheets/reactable-pagination.less';

const propTypes = {
  search: PropTypes.string,
  addDangerToast: PropTypes.func.isRequired,
};

class DashboardTable extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      dashboards: null,
    };
  }

  componentDidMount() {
    SupersetClient.get({
      endpoint:
        '/dashboardasync/api/read?_oc_DashboardModelViewAsync=changed_on&_od_DashboardModelViewAsync=desc',
    })
      .then(({ json }) => {
        this.setState({ dashboards: json.result });
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
      });
  }

  render() {
    if (this.state.dashboards !== null) {
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
            </Tr>
          ))}
        </Table>
      );
    }

    return <Loading />;
  }
}

DashboardTable.propTypes = propTypes;

export default withToasts(DashboardTable);
