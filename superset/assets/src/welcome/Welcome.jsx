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
import { Panel, Row, Col, Tabs, Tab } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import RecentActivity from '../profile/components/RecentActivity';
import Favorites from '../profile/components/Favorites';
import DashboardCardTable from './DashboardCardTable';
import ChartCardTable from './ChartCardTable';

const propTypes = {
  user: PropTypes.object.isRequired,
};

export default class Welcome extends React.PureComponent {
  render() {
    return (
      <div className="container welcome">
        <Tabs defaultActiveKey={1} id="uncontrolled-tab-example">
          <Tab eventKey={1} title={t('Dashboards')}>
            <Panel>
              <DashboardCardTable />
            </Panel>
          </Tab>
          <Tab eventKey={2} title={t('Charts')}>
            <Panel>
              <ChartCardTable />
            </Panel>
          </Tab>
          <Tab eventKey={3} title={t('Recently Viewed')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Recently Viewed')}</h2></Col>
              </Row>
              <hr />
              <RecentActivity user={this.props.user} />
            </Panel>
          </Tab>
          <Tab eventKey={4} title={t('Favorites')}>
            <Panel>
              <Row>
                <Col md={8}><h2>{t('Favorites')}</h2></Col>
              </Row>
              <hr />
              <Favorites user={this.props.user} />
            </Panel>
          </Tab>
        </Tabs>
      </div>
    );
  }
}

Welcome.propTypes = propTypes;
