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
import { FormControl } from 'react-bootstrap';
import SubMenu from 'src/components/Menu/SubMenu';
import { styled, t } from '@superset-ui/core';
import { Collapse } from 'src/common/components';
import { useQueryParam, StringParam, QueryParamConfig } from 'use-query-params';
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

const ActivityContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, max-content));
  grid-gap: ${({ theme }) => theme.gridUnit * 8}px;
  justify-content: center;
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;
`;

const IconContainer = styled.div`
  svg {
    vertical-align: -7px;
  }
`;
export const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(459px, 1fr));
  grid-gap: ${({ theme }) => theme.gridUnit * 8}px;
  justify-content: left;
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;
`;

function useSyncQueryState(
  queryParam: string,
  queryParamType: QueryParamConfig<
    string | null | undefined,
    string | undefined
  >,
  defaultState: string,
): [string, (val: string) => void] {
  const [queryState, setQueryState] = useQueryParam(queryParam, queryParamType);
  const [state, setState] = useState(queryState || defaultState);

  const setQueryStateAndState = (val: string) => {
    setQueryState(val);
    setState(val);
  };

  return [state, setQueryStateAndState];
}

export default function Welcome({ user }: WelcomeProps) {
  const [activeTab, setActiveTab] = useSyncQueryState(
    'activeTab',
    StringParam,
    'all',
  );
  const [queryFilter, setQueryFilter] = useState('Favorite');
  const [activityFilter, setActivityFilter] = useState('Viewed');
  const [dashboardFilter, setDashboardFilter] = useState('Favorite');
  const [chartFilter, setChartFilter] = useState('Favorite');
  const [searchQuery, setSearchQuery] = useSyncQueryState(
    'search',
    StringParam,
    '',
  );
  console.log('user', user);
  return (
    <Collapse defaultActiveKey={['1']}>
      <Panel header={t('Recents')} key="1">
        <SubMenu
          activeChild={activityFilter}
          name=""
          // eslint-disable-next-line react/no-children-prop
          children={[
            {
              name: 'Viewed',
              label: t('Viewed'),
              onClick: () => setActivityFilter('Viewed'),
            },
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
          links={{
            link: `/chart/list`,
            linkTitle: 'View All',
          }}
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
                  <Icon name="plus-small" /> DashBoard{' '}
                </IconContainer>
              ),
              buttonStyle: 'tertiary',
              onClick: () => {
                window.location = '/dashboard/new';
              },
            },
            {
              name: 'View All',
              buttonStyle: 'link',
              onClick: () => { window.location = '/dashboard/list/'}
            },
          ]}
        />
        <FormControl
          type="text"
          bsSize="sm"
          placeholder="Search"
          value={searchQuery}
          // @ts-ignore React bootstrap types aren't quite right here
          onChange={e => setSearchQuery(e.currentTarget.value)}
        />
        <CardContainer>
          <DashboardTable
            search={searchQuery}
            dashboardFilter={dashboardFilter}
            user={user}
          />
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
                window.location = '/superset/sqllab';
              },
            },
            {
              name: 'View All',
              buttonStyle: 'link',
              onClick: () => { window.location = 'superset/sqllab#search'}
            },
          ]}
        />
        <CardContainer>
          <SavedQueries />
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
                window.location = '/chart/add';
              },
            },
            {
              name: 'View All',
              buttonStyle: 'link',
              onClick: () => { window.location = '/chart/list'}
            },
          ]}
        />

        <CardContainer>
          <ChartTable chartFilter={chartFilter} user={user} />
        </CardContainer>
      </Panel>
    </Collapse>
  );
}
