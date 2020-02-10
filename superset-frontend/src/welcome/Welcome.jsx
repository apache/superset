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
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Panel, Row, Col, Tabs, Tab, FormControl } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import { useQueryParam, StringParam } from 'use-query-params';
import RecentActivity from '../profile/components/RecentActivity';
import Favorites from '../profile/components/Favorites';
import DashboardTable from './DashboardTable';

const propTypes = {
  user: PropTypes.object.isRequired,
};

function useSyncQueryState(queryParam, queryParamType, defaultState) {
  const [queryState, setQueryState] = useQueryParam(queryParam, queryParamType);
  const [state, setState] = useState(queryState || defaultState);

  const setQueryStateAndState = val => {
    setQueryState(val);
    setState(val);
  };

  return [state, setQueryStateAndState];
}

export default function Welcome({ user }) {
  const [activeTab, setActiveTab] = useSyncQueryState(
    'activeTab',
    StringParam,
    'all',
  );

  const [searchQuery, setSearchQuery] = useSyncQueryState(
    'search',
    StringParam,
    '',
  );

  return (
    <div className="container welcome">
      <Tabs
        activeKey={activeTab}
        onSelect={setActiveTab}
        id="uncontrolled-tab-example"
      >
        <Tab eventKey="all" title={t('Dashboards')}>
          <Panel>
            <Row>
              <Col md={8}>
                <h2>{t('Dashboards')}</h2>
              </Col>
              <Col md={4}>
                <FormControl
                  type="text"
                  bsSize="sm"
                  style={{ marginTop: '25px' }}
                  placeholder="Search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.currentTarget.value)}
                />
              </Col>
            </Row>
            <hr />
            <DashboardTable search={searchQuery} />
          </Panel>
        </Tab>
        <Tab eventKey="recent" title={t('Recently Viewed')}>
          <Panel>
            <Row>
              <Col md={8}>
                <h2>{t('Recently Viewed')}</h2>
              </Col>
            </Row>
            <hr />
            <RecentActivity user={user} />
          </Panel>
        </Tab>
        <Tab eventKey="favorites" title={t('Favorites')}>
          <Panel>
            <Row>
              <Col md={8}>
                <h2>{t('Favorites')}</h2>
              </Col>
            </Row>
            <hr />
            <Favorites user={user} />
          </Panel>
        </Tab>
      </Tabs>
    </div>
  );
}

Welcome.propTypes = propTypes;
