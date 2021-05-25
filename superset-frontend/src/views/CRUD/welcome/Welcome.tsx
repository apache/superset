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
import React, { useEffect, useState } from 'react';
import { styled, t } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';
import { User } from 'src/types/bootstrapTypes';
import { reject } from 'lodash';
import {
  getFromLocalStorage,
  setInLocalStorage,
} from 'src/utils/localStorageHelpers';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import Loading from 'src/components/Loading';
import {
  createErrorHandler,
  getRecentAcitivtyObjs,
  mq,
  getUserOwnedObjects,
} from 'src/views/CRUD/utils';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { Switch } from 'src/common/components';

import ActivityTable from './ActivityTable';
import ChartTable from './ChartTable';
import SavedQueries from './SavedQueries';
import DashboardTable from './DashboardTable';

interface WelcomeProps {
  user: User;
  addDangerToast: (arg0: string) => void;
}

export interface ActivityData {
  Created?: Array<object>;
  Edited?: Array<object>;
  Viewed?: Array<object>;
  Examples?: Array<object>;
}

const WelcomeContainer = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
  .ant-row.menu {
    margin-top: -15px;
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    &:after {
      content: '';
      display: block;
      border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
      margin: 0px ${({ theme }) => theme.gridUnit * 6}px;
      position: relative;
      width: 100%;
      ${[mq[1]]} {
        margin-top: 5px;
        margin: 0px 2px;
      }
    }
    .ant-menu.ant-menu-light.ant-menu-root.ant-menu-horizontal {
      padding-left: ${({ theme }) => theme.gridUnit * 10}px;
    }
    button {
      padding: 3px 21px;
    }
  }
  .ant-card.ant-card-bordered {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
`;

const WelcomeNav = styled.div`
  height: 50px;
  background-color: white;
  .navbar-brand {
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
  .switch {
    float: right;
    margin: ${({ theme }) => theme.gridUnit * 5}px;
    display: flex;
    flex-direction: row;
    span {
      display: block;
      margin: ${({ theme }) => theme.gridUnit * 1}px;
      line-height: 1;
    }
  }
`;

function Welcome({ user, addDangerToast }: WelcomeProps) {
  const recent = `/superset/recent_activity/${user.userId}/?limit=6`;
  const [activeChild, setActiveChild] = useState('Viewed');
  const [checked, setChecked] = useState(true);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [chartData, setChartData] = useState<Array<object> | null>(null);
  const [queryData, setQueryData] = useState<Array<object> | null>(null);
  const [dashboardData, setDashboardData] = useState<Array<object> | null>(
    null,
  );

  const userid = user.userId;
  const id = userid.toString();

  useEffect(() => {
    const userKey = getFromLocalStorage(id, null);
    if (userKey && !userKey.thumbnails) setChecked(false);
    getRecentAcitivtyObjs(user.userId, recent, addDangerToast)
      .then(res => {
        const data: ActivityData | null = {};
        if (res.viewed) {
          const filtered = reject(res.viewed, ['item_url', null]).map(r => r);
          data.Viewed = filtered;
          const savedActivity = getFromLocalStorage('activity', null);
          if (!savedActivity) {
            setActiveChild('Viewed');
          } else setActiveChild(savedActivity.activity);
        } else {
          data.Examples = res.examples;
          setActiveChild('Examples');
        }
        setActivityData(activityData => ({ ...activityData, ...data }));
      })
      .catch(
        createErrorHandler((errMsg: unknown) => {
          setActivityData(activityData => ({ ...activityData, Viewed: [] }));
          addDangerToast(
            t('There was an issue fetching your recent activity: %s', errMsg),
          );
        }),
      );

    // Sets other activity data in parallel with recents api call
    getUserOwnedObjects(id, 'dashboard')
      .then(r => {
        setDashboardData(r);
      })
      .catch((err: unknown) => {
        setDashboardData([]);
        addDangerToast(
          t('There was an issues fetching your dashboards: %s', err),
        );
      });
    getUserOwnedObjects(id, 'chart')
      .then(r => {
        setChartData(r);
      })
      .catch((err: unknown) => {
        setChartData([]);
        addDangerToast(t('There was an issues fetching your chart: %s', err));
      });
    getUserOwnedObjects(id, 'saved_query')
      .then(r => {
        setQueryData(r);
      })
      .catch((err: unknown) => {
        setQueryData([]);
        addDangerToast(
          t('There was an issues fetching your saved queries: %s', err),
        );
      });
  }, []);

  const handleToggle = () => {
    setChecked(!checked);
    setInLocalStorage(id, { thumbnails: !checked });
  };

  useEffect(() => {
    setActivityData(activityData => ({
      ...activityData,
      Created: [
        ...(chartData || []),
        ...(dashboardData || []),
        ...(queryData || []),
      ],
    }));
  }, [chartData, queryData, dashboardData]);

  return (
    <WelcomeContainer>
      <WelcomeNav>
        <span className="navbar-brand">Home</span>
        {isFeatureEnabled(FeatureFlag.THUMBNAILS) ? (
          <div className="switch">
            <Switch checked={checked} onChange={handleToggle} />
            <span>Thumbnails</span>
          </div>
        ) : null}
      </WelcomeNav>
      <Collapse defaultActiveKey={['1', '2', '3', '4']} ghost bigger>
        <Collapse.Panel header={t('Recents')} key="1">
          {activityData && (activityData.Viewed || activityData.Examples) ? (
            <ActivityTable
              user={user}
              activeChild={activeChild}
              setActiveChild={setActiveChild}
              activityData={activityData}
            />
          ) : (
            <Loading position="inline" />
          )}
        </Collapse.Panel>
        <Collapse.Panel header={t('Dashboards')} key="2">
          {!dashboardData ? (
            <Loading position="inline" />
          ) : (
            <DashboardTable
              user={user}
              mine={dashboardData}
              showThumbnails={checked}
            />
          )}
        </Collapse.Panel>
        <Collapse.Panel header={t('Saved queries')} key="3">
          {!queryData ? (
            <Loading position="inline" />
          ) : (
            <SavedQueries
              showThumbnails={checked}
              user={user}
              mine={queryData}
              featureFlag={isFeatureEnabled(FeatureFlag.THUMBNAILS)}
            />
          )}
        </Collapse.Panel>
        <Collapse.Panel header={t('Charts')} key="4">
          {!chartData ? (
            <Loading position="inline" />
          ) : (
            <ChartTable showThumbnails={checked} user={user} mine={chartData} />
          )}
        </Collapse.Panel>
      </Collapse>
    </WelcomeContainer>
  );
}

export default withToasts(Welcome);
