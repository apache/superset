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
import SubMenu from 'src/components/Menu/SubMenu';
import { styled, t } from '@superset-ui/core';
import { Collapse } from 'src/common/components';
import { User } from 'src/types/bootstrapTypes';
import Icon from 'src/components/Icon';

import ActivityTable from './ActivityTable';
import ChartTable from './ChartTable';
import SavedQueries from './SavedQueries';
import DashboardTable from './DashboardTable';

const { Panel } = Collapse;

interface WelcomeProps {
  user: User;
}

const WelcomeContainer = styled.div`
  nav {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    &:after {
      content: '';
      display: block;
      border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
      margin: 0px 26px;
    }
  }
  .ant-card.ant-card-bordered {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
`;

const ActivityContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(31%, max-content));
  grid-gap: ${({ theme }) => theme.gridUnit * 8}px;
  justify-content: center;
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;
`;

const IconContainer = styled.div`
  svg {
    vertical-align: -7px;
    color: ${({ theme }) => theme.colors.primary.dark1};
  }
`;
export const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(459px, 1fr));
  grid-gap: ${({ theme }) => theme.gridUnit * 8}px;
  justify-content: left;
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 6}px;
`;

export default function Welcome({ user }: WelcomeProps) {
  const [queryFilter, setQueryFilter] = useState('Favorite');
  const [activityFilter, setActivityFilter] = useState('Edited');
  const [dashboardFilter, setDashboardFilter] = useState('Favorite');
  const [chartFilter, setChartFilter] = useState('Favorite');

  function ExpandIcon(): React.ReactNode {
    return <Icon name="caret-right" />;
  }

  return (
    <WelcomeContainer>
      <Collapse defaultActiveKey={['1']} ghost>
        <Panel header={t('Recents')} key="1">
          <SubMenu
            activeChild={activityFilter}
            name=""
            // eslint-disable-next-line react/no-children-prop
            children={[
              {
                name: 'Edited',
                label: t('Edited'),
                onClick: () => setActivityFilter('Edited'),
              },
              {
                name: 'Created',
                label: t('Created'),
                onClick: () => setActivityFilter('Created'),
              },
            ]}
          />
          <ActivityContainer>
            <ActivityTable user={user} activityFilter={activityFilter} />
          </ActivityContainer>
        </Panel>

        <Panel header={t('Dashboards')} key="2">
          <SubMenu
            activeChild={dashboardFilter}
            name=""
            // eslint-disable-next-line react/no-children-prop
            children={[
              {
                name: 'Favorite',
                label: t('Favorite'),
                onClick: () => setDashboardFilter('Favorite'),
              },
              {
                name: 'Mine',
                label: t('Mine'),
                onClick: () => setDashboardFilter('Mine'),
              },
            ]}
            buttons={[
              {
                name: (
                  <IconContainer>
                    <Icon name="plus-small" /> Dashboard{' '}
                  </IconContainer>
                ),
                buttonStyle: 'tertiary',
                onClick: () => {
                  // @ts-ignore
                  window.location = '/dashboard/new';
                },
              },
              {
                name: 'View All',
                buttonStyle: 'link',
                onClick: () => {
                  // @ts-ignore
                  window.location = '/dashboard/list/';
                },
              },
            ]}
          />
          <CardContainer>
            <DashboardTable dashboardFilter={dashboardFilter} user={user} />
          </CardContainer>
        </Panel>

        <Panel header={t('Saved Queries')} key="3">
          <SubMenu
            activeChild={queryFilter}
            name=""
            // eslint-disable-next-line react/no-children-prop
            children={[
              {
                name: 'Favorite',
                label: t('Favorite'),
                onClick: () => setQueryFilter('Favorite'),
              },
              {
                name: 'Mine',
                label: t('Mine'),
                onClick: () => setQueryFilter('Mine'),
              },
            ]}
            buttons={[
              {
                name: (
                  <IconContainer>
                    <Icon name="plus-small" /> SQL Query{' '}
                  </IconContainer>
                ),
                buttonStyle: 'tertiary',
                onClick: () => {
                  // @ts-ignore
                  window.location = '/superset/sqllab';
                },
              },
              {
                name: 'View All',
                buttonStyle: 'link',
                onClick: () => {
                  // @ts-ignore
                  window.location = '/savedqueryview/list';
                },
              },
            ]}
          />
          <CardContainer>
            <SavedQueries user={user} queryFilter={queryFilter} />
          </CardContainer>
        </Panel>
        <Panel header={t('Charts')} key="4">
          <SubMenu
            activeChild={chartFilter}
            name=""
            // eslint-disable-next-line react/no-children-prop
            children={[
              {
                name: 'Favorite',
                label: t('Favorite'),
                onClick: () => setChartFilter('Favorite'),
              },
              {
                name: 'Mine',
                label: t('Mine'),
                onClick: () => setChartFilter('Mine'),
              },
            ]}
            buttons={[
              {
                name: (
                  <IconContainer>
                    <Icon name="plus-small" /> Chart{' '}
                  </IconContainer>
                ),
                buttonStyle: 'tertiary',
                onClick: () => {
                  // @ts-ignore
                  window.location = '/chart/add';
                },
              },
              {
                name: 'View All',
                buttonStyle: 'link',
                onClick: () => {
                  // @ts-ignore
                  window.location = '/chart/list';
                },
              },
            ]}
          />

          <CardContainer>
            <ChartTable chartFilter={chartFilter} user={user} />
          </CardContainer>
        </Panel>
      </Collapse>
    </WelcomeContainer>
  );
}
