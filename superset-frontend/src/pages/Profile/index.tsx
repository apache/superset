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
import { Row, Col } from 'src/components';
import Tabs from 'src/components/Tabs';
import { BootstrapUser } from 'src/types/bootstrapTypes';
import Favorites from 'src/features/profile/Favorites';
import UserInfo from 'src/features/profile/UserInfo';
import Security from 'src/features/profile/Security';
import RecentActivity from 'src/features/profile/RecentActivity';
import CreatedContent from 'src/features/profile/CreatedContent';

interface AppProps {
  user: BootstrapUser;
}

const StyledTabPane = styled(Tabs.TabPane)`
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

export default function App({ user }: AppProps) {
  return (
    <div className="container app">
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <UserInfo user={user} />
        </Col>
        <Col xs={24} md={18}>
          <Tabs centered>
            <StyledTabPane
              key="1"
              tab={
                <div>
                  <i className="fa fa-star" /> {t('Favorites')}
                </div>
              }
            >
              <Favorites user={user} />
            </StyledTabPane>
            <StyledTabPane
              key="2"
              tab={
                <div>
                  <i className="fa fa-paint-brush" /> {t('Created content')}
                </div>
              }
            >
              <CreatedContent user={user} />
            </StyledTabPane>
            <StyledTabPane
              key="3"
              tab={
                <div>
                  <i className="fa fa-list" /> {t('Recent activity')}
                </div>
              }
            >
              <RecentActivity user={user} />
            </StyledTabPane>
            <StyledTabPane
              key="4"
              tab={
                <div>
                  <i className="fa fa-lock" /> {t('Security & Access')}
                </div>
              }
            >
              <Security user={user} />
            </StyledTabPane>
          </Tabs>
        </Col>
      </Row>
    </div>
  );
}
