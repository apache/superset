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
import { styled, t } from '@superset-ui/core';
import { Collapse } from 'src/common/components';
import { User } from 'src/types/bootstrapTypes';
import { mq } from '../utils';
import ActivityTable from './ActivityTable';
import ChartTable from './ChartTable';
import SavedQueries from './SavedQueries';
import DashboardTable from './DashboardTable';

const { Panel } = Collapse;

interface WelcomeProps {
  user: User;
}

const WelcomeContainer = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
  nav {
    margin-top: -15px;
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    &:after {
      content: '';
      display: block;
      border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
      margin: 0px ${({ theme }) => theme.gridUnit * 6}px;
      position: relative;
      ${[mq[1]]} {
        margin-top: 5px;
        margin: 0px 2px;
      }
    }
    .nav.navbar-nav {
      & > li:nth-child(1),
      & > li:nth-child(2),
      & > li:nth-child(3) {
        margin-top: ${({ theme }) => theme.gridUnit * 2}px;
      }
    }
    button {
      padding: 3px 21px;
    }
    .navbar-right {
      position: relative;
      top: 11px;
    }
  }
  .ant-card.ant-card-bordered {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
  .ant-collapse-header {
    font-weight: ${({ theme }) => theme.typography.weights.normal};
    font-size: ${({ theme }) => theme.gridUnit * 4}px;
  }
`;

export default function Welcome({ user }: WelcomeProps) {
  return (
    <WelcomeContainer>
      <Collapse defaultActiveKey={['1', '2', '3', '4']} ghost>
        <Panel header={t('Recents')} key="1">
          <ActivityTable user={user} />
        </Panel>
        <Panel header={t('Dashboards')} key="2">
          <DashboardTable user={user} />
        </Panel>
        <Panel header={t('Saved Queries')} key="3">
          <SavedQueries user={user} />
        </Panel>
        <Panel header={t('Charts')} key="4">
          <ChartTable user={user} />
        </Panel>
      </Collapse>
    </WelcomeContainer>
  );
}
