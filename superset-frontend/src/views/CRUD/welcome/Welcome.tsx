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
import React, { useEffect, useMemo, useState } from 'react';
import {
  getExtensionsRegistry,
  JsonObject,
  styled,
  t,
} from '@superset-ui/core';
import rison from 'rison';
import Collapse from 'src/components/Collapse';
import { User } from 'src/types/bootstrapTypes';
import { reject } from 'lodash';
import {
  getItem,
  dangerouslyGetItemDoNotUse,
  setItem,
  dangerouslySetItemDoNotUse,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import ListViewCard from 'src/components/ListViewCard';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  createErrorHandler,
  getRecentActivityObjs,
  mq,
  CardContainer,
  getUserOwnedObjects,
  loadingCardCount,
} from 'src/views/CRUD/utils';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { AntdSwitch } from 'src/components';
import getBootstrapData from 'src/utils/getBootstrapData';
import { TableTab } from 'src/views/CRUD/types';
import { canUserAccessSqlLab } from 'src/dashboard/util/permissionUtils';
import { WelcomePageLastTab } from './types';
import ActivityTable from './ActivityTable';
import ChartTable from './ChartTable';
import SavedQueries from './SavedQueries';
import DashboardTable from './DashboardTable';

const extensionsRegistry = getExtensionsRegistry();

interface WelcomeProps {
  user: User;
  addDangerToast: (arg0: string) => void;
}

export interface ActivityData {
  [TableTab.Created]?: JsonObject[];
  [TableTab.Edited]?: JsonObject[];
  [TableTab.Viewed]?: JsonObject[];
  [TableTab.Other]?: JsonObject[];
}

interface LoadingProps {
  cover?: boolean;
}

const DEFAULT_TAB_ARR = ['2', '3'];

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
      ${mq[1]} {
        margin-top: 5px;
        margin: 0px 2px;
      }
    }
    .ant-menu.ant-menu-light.ant-menu-root.ant-menu-horizontal {
      padding-left: ${({ theme }) => theme.gridUnit * 8}px;
    }
    button {
      padding: 3px 21px;
    }
  }
  .ant-card-meta-description {
    margin-top: ${({ theme }) => theme.gridUnit}px;
  }
  .ant-card.ant-card-bordered {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
  .ant-collapse-item .ant-collapse-content {
    margin-bottom: ${({ theme }) => theme.gridUnit * -6}px;
  }
  div.ant-collapse-item:last-child.ant-collapse-item-active
    .ant-collapse-header {
    padding-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }
  div.ant-collapse-item:last-child .ant-collapse-header {
    padding-bottom: ${({ theme }) => theme.gridUnit * 9}px;
  }
  .loading-cards {
    margin-top: ${({ theme }) => theme.gridUnit * 8}px;
    .ant-card-cover > div {
      height: 168px;
    }
  }
`;

const WelcomeNav = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: space-between;
    height: 50px;
    background-color: ${theme.colors.grayscale.light5};
    .welcome-header {
      font-size: ${theme.typography.sizes.l}px;
      padding: ${theme.gridUnit * 4}px ${theme.gridUnit * 2 + 2}px;
      margin: 0 ${theme.gridUnit * 2}px;
    }
    .switch {
      display: flex;
      flex-direction: row;
      margin: ${theme.gridUnit * 4}px;
      span {
        display: block;
        margin: ${theme.gridUnit * 1}px;
        line-height: 1;
      }
    }
  `}
`;

const bootstrapData = getBootstrapData();

export const LoadingCards = ({ cover }: LoadingProps) => (
  <CardContainer showThumbnails={cover} className="loading-cards">
    {[...new Array(loadingCardCount)].map((_, index) => (
      <ListViewCard
        key={index}
        cover={cover ? false : <></>}
        description=""
        loading
      />
    ))}
  </CardContainer>
);

function Welcome({ user, addDangerToast }: WelcomeProps) {
  const canAccessSqlLab = canUserAccessSqlLab(user);
  const userid = user.userId;
  const id = userid!.toString(); // confident that user is not a guest user
  const params = rison.encode({ page_size: 6 });
  const recent = `/api/v1/log/recent_activity/${user.userId}/?q=${params}`;
  const [activeChild, setActiveChild] = useState('Loading');
  const userKey = dangerouslyGetItemDoNotUse(id, null);
  let defaultChecked = false;
  if (isFeatureEnabled(FeatureFlag.THUMBNAILS)) {
    defaultChecked =
      userKey?.thumbnails === undefined ? true : userKey?.thumbnails;
  }
  const [checked, setChecked] = useState(defaultChecked);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [chartData, setChartData] = useState<Array<object> | null>(null);
  const [queryData, setQueryData] = useState<Array<object> | null>(null);
  const [dashboardData, setDashboardData] = useState<Array<object> | null>(
    null,
  );
  const [isFetchingActivityData, setIsFetchingActivityData] = useState(true);

  const collapseState = getItem(LocalStorageKeys.homepage_collapse_state, []);
  const [activeState, setActiveState] = useState<Array<string>>(collapseState);

  const handleCollapse = (state: Array<string>) => {
    setActiveState(state);
    setItem(LocalStorageKeys.homepage_collapse_state, state);
  };

  const WelcomeMessageExtension = extensionsRegistry.get('welcome.message');
  const WelcomeTopExtension = extensionsRegistry.get('welcome.banner');
  const WelcomeMainExtension = extensionsRegistry.get(
    'welcome.main.replacement',
  );

  const [otherTabTitle, otherTabFilters] = useMemo(() => {
    const lastTab = bootstrapData.common?.conf
      .WELCOME_PAGE_LAST_TAB as WelcomePageLastTab;
    const [customTitle, customFilter] = Array.isArray(lastTab)
      ? lastTab
      : [undefined, undefined];
    if (customTitle && customFilter) {
      return [t(customTitle), customFilter];
    }
    if (lastTab === 'all') {
      return [t('All'), []];
    }
    return [
      t('Examples'),
      [
        {
          col: 'created_by',
          opr: 'rel_o_m',
          value: 0,
        },
      ],
    ];
  }, []);

  useEffect(() => {
    if (!otherTabFilters) {
      return;
    }
    const activeTab = getItem(LocalStorageKeys.homepage_activity_filter, null);
    setActiveState(collapseState.length > 0 ? collapseState : DEFAULT_TAB_ARR);
    getRecentActivityObjs(user.userId!, recent, addDangerToast, otherTabFilters)
      .then(res => {
        const data: ActivityData | null = {};
        data[TableTab.Other] = res.other;
        if (res.viewed) {
          const filtered = reject(res.viewed, ['item_url', null]).map(r => r);
          data[TableTab.Viewed] = filtered;
          if (!activeTab && data[TableTab.Viewed]) {
            setActiveChild(TableTab.Viewed);
          } else if (!activeTab && !data[TableTab.Viewed]) {
            setActiveChild(TableTab.Created);
          } else setActiveChild(activeTab || TableTab.Created);
        } else if (!activeTab) setActiveChild(TableTab.Created);
        else setActiveChild(activeTab);
        setActivityData(activityData => ({ ...activityData, ...data }));
      })
      .catch(
        createErrorHandler((errMsg: unknown) => {
          setActivityData(activityData => ({
            ...activityData,
            [TableTab.Viewed]: [],
          }));
          addDangerToast(
            t('There was an issue fetching your recent activity: %s', errMsg),
          );
        }),
      );

    // Sets other activity data in parallel with recents api call
    const ownSavedQueryFilters = [
      {
        col: 'created_by',
        opr: 'rel_o_m',
        value: `${id}`,
      },
    ];
    Promise.all([
      getUserOwnedObjects(id, 'dashboard')
        .then(r => {
          setDashboardData(r);
          return Promise.resolve();
        })
        .catch((err: unknown) => {
          setDashboardData([]);
          addDangerToast(
            t('There was an issue fetching your dashboards: %s', err),
          );
          return Promise.resolve();
        }),
      getUserOwnedObjects(id, 'chart')
        .then(r => {
          setChartData(r);
          return Promise.resolve();
        })
        .catch((err: unknown) => {
          setChartData([]);
          addDangerToast(t('There was an issue fetching your chart: %s', err));
          return Promise.resolve();
        }),
      canAccessSqlLab
        ? getUserOwnedObjects(id, 'saved_query', ownSavedQueryFilters)
            .then(r => {
              setQueryData(r);
              return Promise.resolve();
            })
            .catch((err: unknown) => {
              setQueryData([]);
              addDangerToast(
                t('There was an issue fetching your saved queries: %s', err),
              );
              return Promise.resolve();
            })
        : Promise.resolve(),
    ]).then(() => {
      setIsFetchingActivityData(false);
    });
  }, [otherTabFilters]);

  const handleToggle = () => {
    setChecked(!checked);
    dangerouslySetItemDoNotUse(id, { thumbnails: !checked });
  };

  useEffect(() => {
    if (!collapseState && queryData?.length) {
      setActiveState(activeState => [...activeState, '4']);
    }
    setActivityData(activityData => ({
      ...activityData,
      Created: [
        ...(chartData?.slice(0, 3) || []),
        ...(dashboardData?.slice(0, 3) || []),
        ...(queryData?.slice(0, 3) || []),
      ],
    }));
  }, [chartData, queryData, dashboardData]);

  useEffect(() => {
    if (!collapseState && activityData?.[TableTab.Viewed]?.length) {
      setActiveState(activeState => ['1', ...activeState]);
    }
  }, [activityData]);

  const isRecentActivityLoading =
    !activityData?.[TableTab.Other] && !activityData?.[TableTab.Viewed];

  return (
    <WelcomeContainer>
      {WelcomeMessageExtension && <WelcomeMessageExtension />}
      {WelcomeTopExtension && <WelcomeTopExtension />}
      {WelcomeMainExtension && <WelcomeMainExtension />}
      {(!WelcomeTopExtension || !WelcomeMainExtension) && (
        <>
          <WelcomeNav>
            <h1 className="welcome-header">{t('Home')}</h1>
            {isFeatureEnabled(FeatureFlag.THUMBNAILS) ? (
              <div className="switch">
                <AntdSwitch checked={checked} onChange={handleToggle} />
                <span>{t('Thumbnails')}</span>
              </div>
            ) : null}
          </WelcomeNav>
          <Collapse
            activeKey={activeState}
            onChange={handleCollapse}
            ghost
            bigger
          >
            <Collapse.Panel header={t('Recents')} key="1">
              {activityData &&
              (activityData[TableTab.Viewed] ||
                activityData[TableTab.Other] ||
                activityData[TableTab.Created]) &&
              activeChild !== 'Loading' ? (
                <ActivityTable
                  user={{ userId: user.userId! }} // user is definitely not a guest user on this page
                  activeChild={activeChild}
                  setActiveChild={setActiveChild}
                  activityData={activityData}
                  isFetchingActivityData={isFetchingActivityData}
                />
              ) : (
                <LoadingCards />
              )}
            </Collapse.Panel>
            <Collapse.Panel header={t('Dashboards')} key="2">
              {!dashboardData || isRecentActivityLoading ? (
                <LoadingCards cover={checked} />
              ) : (
                <DashboardTable
                  user={user}
                  mine={dashboardData}
                  showThumbnails={checked}
                  otherTabData={activityData?.[TableTab.Other]}
                  otherTabFilters={otherTabFilters}
                  otherTabTitle={otherTabTitle}
                />
              )}
            </Collapse.Panel>
            <Collapse.Panel header={t('Charts')} key="3">
              {!chartData || isRecentActivityLoading ? (
                <LoadingCards cover={checked} />
              ) : (
                <ChartTable
                  showThumbnails={checked}
                  user={user}
                  mine={chartData}
                  otherTabData={activityData?.[TableTab.Other]}
                  otherTabFilters={otherTabFilters}
                  otherTabTitle={otherTabTitle}
                />
              )}
            </Collapse.Panel>
            {canAccessSqlLab && (
              <Collapse.Panel header={t('Saved queries')} key="4">
                {!queryData ? (
                  <LoadingCards cover={checked} />
                ) : (
                  <SavedQueries
                    showThumbnails={checked}
                    user={user}
                    mine={queryData}
                    featureFlag={isFeatureEnabled(FeatureFlag.THUMBNAILS)}
                  />
                )}
              </Collapse.Panel>
            )}
          </Collapse>
        </>
      )}
    </WelcomeContainer>
  );
}

export default withToasts(Welcome);
