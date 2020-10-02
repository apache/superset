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
import RecentActivity from 'src/profile/components/RecentActivity';
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

export const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(459px, max-content));
  grid-gap: ${({ theme }) => theme.gridUnit * 8}px;
  justify-content: center;
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

function ding(e: any) {
  console.log('event', e);
}

export default function Welcome({ user }: WelcomeProps) {
  const [activeTab, setActiveTab] = useSyncQueryState(
    'activeTab',
    StringParam,
    'all',
  );
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
          activeChild={activtyFilter}
          name=""
          // eslint-disable-next-line react/no-children-prop
          children={[
            {
              name: 'Viewed',
              label: t('Viewed'),
              onClick: () => ding('hi?'),
            },
            {
              name: 'Edited',
              label: t('Edited'),
              onClick: ding,
            },
            {
              name: 'Created',
              label: t('Created'),
              onClick: ding,
            },
          ]}
        />
        <ActivityContainer>
          <ActivityTable user={user} activityFilter={activtyFilter} />
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
          activeChild={dashboardFilter}
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
        />
        <ChartTable chartFilter={chartFilter} user={user} />
      </Panel>
    </Collapse>
  );
}
