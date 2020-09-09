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
import PropTypes from 'prop-types';
import { t, SupersetClient } from '@superset-ui/core';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import Omnibar from 'omnibar';
import { LOG_ACTIONS_OMNIBAR_TRIGGERED } from '../logger/LogUtils';

const propTypes = {
  logEvent: PropTypes.func.isRequired,
};

const getDashboards = query =>
  // todo: Build a dedicated endpoint for dashboard searching
  // i.e. superset/v1/api/dashboards?q=${query}
  SupersetClient.get({
    endpoint: `/dashboardasync/api/read?_oc_DashboardModelViewAsync=changed_on&_od_DashboardModelViewAsync=desc&_flt_2_dashboard_title=${query}`,
  })
    .then(({ json }) =>
      json.result.map(item => ({
        title: item.dashboard_title,
        ...item,
      })),
    )
    .catch(() => ({
      title: t('An error occurred while fethching Dashboards'),
    }));

class OmniContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showOmni: false,
    };
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  handleKeydown(event) {
    const controlOrCommand = event.ctrlKey || event.metaKey;
    if (controlOrCommand && isFeatureEnabled(FeatureFlag.OMNIBAR)) {
      const isK = event.key === 'k' || event.keyCode === 83;
      if (isK) {
        this.props.logEvent(LOG_ACTIONS_OMNIBAR_TRIGGERED, {
          show_omni: !this.state.showOmni,
        });

        this.setState({ showOmni: !this.state.showOmni });

        document.getElementsByClassName('Omnibar')[0].focus();
      }
    }
  }

  render() {
    return (
      <Modal show={this.state.showOmni} style={{ marginTop: '25%' }}>
        <Omnibar
          className="Omnibar"
          placeholder="Search all dashboards"
          extensions={[getDashboards]}
        />
      </Modal>
    );
  }
}

OmniContainer.propTypes = propTypes;
export default OmniContainer;
