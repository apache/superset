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
import { t, styled } from '@superset-ui/core';
import { Row, Col } from 'src/common/components';
import Tabs from 'src/common/components/Tabs';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import Favorites from './Favorites';
import UserInfo from './UserInfo';
import Security from './Security';
import RecentActivity from './RecentActivity';
import CreatedContent from './CreatedContent';

interface AppProps {
  user: UserWithPermissionsAndRoles;
}

const StyledPanel = styled.div`
  padding: 10px;
  .ant-tabs-content-holder {
    background-color: white;
    padding: 16px;
  }
`;

export default function App({ user }: AppProps) {
  return (
    <div className="container app">
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <UserInfo user={user} />
        </Col>
        <Col xs={24} md={18}>
          <StyledPanel>
            <Tabs centered>
              <Tabs.TabPane
                key="1"
                tab={
                  <div>
                    <i className="fa fa-star" /> {t('Favorites')}
                  </div>
                }
              >
                <Favorites user={user} />
              </Tabs.TabPane>
              <Tabs.TabPane
                key="2"
                tab={
                  <div>
                    <i className="fa fa-paint-brush" /> {t('Created content')}
                  </div>
                }
              >
                <CreatedContent user={user} />
              </Tabs.TabPane>
              <Tabs.TabPane
                key="3"
                tab={
                  <div>
                    <i className="fa fa-list" /> {t('Recent activity')}
                  </div>
                }
              >
                <RecentActivity user={user} />
              </Tabs.TabPane>
              <Tabs.TabPane
                key="4"
                tab={
                  <div>
                    <i className="fa fa-lock" /> {t('Security & Access')}
                  </div>
                }
              >
                    <Security user={user} />
              </Tabs.TabPane>
            </Tabs>
          </StyledPanel>
        </Col>
      </Row>
    </div>
  );
}
