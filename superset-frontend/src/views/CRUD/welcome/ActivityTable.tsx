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

import Loading from 'src/components/Loading';
import SubMenu from 'src/components/Menu/SubMenu';
import { mq } from 'src/views/CRUD/utils';
import ActivityTableRow from './ActivityTableRow';
import { ActivityData } from './Welcome';
import EmptyState from './EmptyState';

interface ActivityProps {
  user: {
    userId: string | number;
  };
  activeChild: string;
  setActiveChild: (arg0: string) => void;
  loading: boolean;
  activityData: ActivityData;
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
  padding: ${({ theme }) => theme.gridUnit * 6}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2}px;
  .ant-card-meta-avatar {
    margin-top: ${({ theme }) => theme.gridUnit * 3}px;
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  }
  .ant-card-meta-title {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
`;

export default function ActivityTable({
  loading,
  activeChild,
  setActiveChild,
  activityData,
}: ActivityProps) {
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

  if (activityData?.Viewed) {
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

  if (loading) return <Loading position="inline" />;
  return (
    <>
      <SubMenu
        activeChild={activeChild}
        // eslint-disable-next-line react/no-children-prop
        tabs={tabs}
      />
      <>
        {activityData[activeChild]?.length > 0 ? (
          <ActivityContainer>
            <ActivityTableRow
              activityList={activityData[activeChild]}
              activeChild={activeChild}
              loading={loading}
            />
          </ActivityContainer>
        ) : (
          <EmptyState tableName="RECENTS" tab={activeChild} />
        )}
      </>
    </>
  );
}
