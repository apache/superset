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
import moment from 'antd/node_modules/moment';
import { styled, t } from '@superset-ui/core';

import ListViewCard from 'src/components/ListViewCard';
import { addDangerToast } from 'src/messageToasts/actions';
import SubMenu from 'src/components/Menu/SubMenu';
import { reject } from 'lodash';
import { getRecentAcitivtyObjs, mq } from '../utils';
import EmptyState from './EmptyState';

interface MapProps {
  action?: string;
  item_title?: string;
  slice_name: string;
  time: string;
  changed_on_utc: string;
  url: string;
  sql: string;
  dashboard_title: string;
  label: string;
  id: string;
  table: object;
  item_url: string;
}

interface ActivityProps {
  user: {
    userId: string | number;
  };
}

interface ActivityData {
  Created?: Array<object>;
  Edited?: Array<object>;
  Viewed?: Array<object>;
  Examples?: Array<object>;
}

const ActivityContainer = styled.div`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  margin-top: ${({ theme }) => theme.gridUnit * -4}px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(31%, max-content));
  ${[mq[3]]} {
    grid-template-columns: repeat(auto-fit, minmax(31%, max-content));
  }
  ${[mq[2]]} {
    grid-template-columns: repeat(auto-fit, minmax(42%, max-content));
  }
  ${[mq[1]]} {
    grid-template-columns: repeat(auto-fit, minmax(63%, max-content));
  }
  grid-gap: ${({ theme }) => theme.gridUnit * 8}px;
  justify-content: left;
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;
  .ant-card-meta-avatar {
    margin-top: ${({ theme }) => theme.gridUnit * 3}px;
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  }
  .ant-card-meta-title {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
`;

export default function ActivityTable({ user }: ActivityProps) {
  const [activityData, setActivityData] = useState<ActivityData>({});
  const [loading, setLoading] = useState(true);
  const [activeChild, setActiveChild] = useState('Viewed');
  // this api uses log for data which in some cases can be empty
  const recent = `/superset/recent_activity/${user.userId}/?limit=5`;

  const getFilterTitle = (e: MapProps) => {
    if (e.dashboard_title) return e.dashboard_title;
    if (e.label) return e.label;
    if (e.url && !e.table) return e.item_title;
    if (e.item_title) return e.item_title;
    return e.slice_name;
  };

  const getIconName = (e: MapProps) => {
    if (e.sql) return 'sql';
    if (e.url?.includes('dashboard')) {
      return 'nav-dashboard';
    }
    if (e.url?.includes('explore') || e.item_url?.includes('explore')) {
      return 'nav-charts';
    }
    return '';
  };

  const tabs = [
    {
      name: 'Edited',
      label: t('Edited'),
      onClick: () => {
        setActiveChild('Edited');
      },
    },
    {
      name: 'Created',
      label: t('Created'),
      onClick: () => {
        setActiveChild('Created');
      },
    },
  ];

  if (activityData.Viewed) {
    tabs.unshift({
      name: 'Viewed',
      label: t('Viewed'),
      onClick: () => {
        setActiveChild('Viewed');
      },
    });
  } else {
    tabs.unshift({
      name: 'Examples',
      label: t('Examples'),
      onClick: () => {
        setActiveChild('Examples');
      },
    });
  }

  useEffect(() => {
    getRecentAcitivtyObjs(user.userId, recent)
      .then(res => {
        const data: any = {
          Created: [...res.createdByChart, ...res.createdByDash],
          Edited: [...res.editedChart, ...res.editedDash],
        };
        if (res.viewed) {
          const filtered = reject(res.viewed, ['item_url', null]).map(r => r);
          data.Viewed = filtered;
          setActiveChild('Viewed');
        } else {
          data.Examples = res.examples;
          setActiveChild('Examples');
        }
        setActivityData(data);
        setLoading(false);
      })
      .catch(e => {
        setLoading(false);
        addDangerToast(
          `There was an issue fetching your recent Acitivity: ${e}`,
        );
      });
  }, []);

  const renderActivity = () => {
    return activityData[activeChild].map((e: MapProps) => (
      <ListViewCard
        key={`${e.id}`}
        isRecent
        loading={loading}
        url={e.sql ? `/supserset/sqllab?queryId=${e.id}` : e.url}
        title={getFilterTitle(e)}
        description={`Last Edited: ${moment(e.changed_on_utc).format(
          'MM/DD/YYYY HH:mm:ss',
        )}`}
        avatar={getIconName(e)}
        actions={null}
      />
    ));
  };
  if (loading) return <>loading ...</>;
  return (
    <>
      <SubMenu
        activeChild={activeChild}
        // eslint-disable-next-line react/no-children-prop
        tabs={tabs}
      />
      <>
        {activityData[activeChild]?.length > 0 ? (
          <ActivityContainer>{renderActivity()}</ActivityContainer>
        ) : (
          <EmptyState tableName="RECENTS" tab={activeChild} />
        )}
      </>
    </>
  );
}
