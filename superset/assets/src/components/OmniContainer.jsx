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
import { Modal } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import Omnibar from 'omnibar';

const getDashboards = query =>
  // todo: Build a dedicated endpoint for dashboard searching
  // i.e. superset/v1/api/dashboards?q=${query}
   SupersetClient.get({
        endpoint: `/dashboardasync/api/read?_oc_DashboardModelViewAsync=changed_on&_od_DashboardModelViewAsync=desc&_flt_2_dashboard_title=${query}`,
      })
        .then(({ json }) => json.result.map(item => ({
            title: item.dashboard_title,
            ...item,
          }),
        ))
        .catch(() => ({
            title: t('An error occurred while fethching Dashboards'),
        }));

export default class OmniContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showOmni: true,
    };
  }
  render() {
      return (
        <Modal show={this.state.showOmni} ref={this.exampleRef}>
          <Omnibar placeholder="Search for dashboards.." extensions={[getDashboards]} />
        </Modal>
      )
  }
}
