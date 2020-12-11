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
import { Collapse } from 'src/common/components';
import { User } from 'src/types/bootstrapTypes';
import { reject } from 'lodash';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import Loading from 'src/components/Loading';
import { getRecentAcitivtyObjs, mq } from '../utils';

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
  myChart?: Array<object>;
  myDash?: Array<object>;
  myQuery?: Array<object>;
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
`;

function Welcome({ user, addDangerToast }: WelcomeProps) {
  const recent = `/superset/recent_activity/${user.userId}/?limit=6`;
  const [activeChild, setActiveChild] = useState('Viewed');
  const [activityData, setActivityData] = useState<ActivityData>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getRecentAcitivtyObjs(user.userId, recent, addDangerToast)
      .then(res => {
        const data: any = {
          Created: [
            ...res.createdByChart,
            ...res.createdByDash,
            ...res.createdByQuery,
          ],
          myChart: res.createdByChart,
          myDash: res.createdByDash,
          myQuery: res.createdByQuery,
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
          `There was an issue fetching your recent acitivity: ${e}`,
        );
      });
  }, []);

  return (
    <WelcomeContainer>
      <Collapse defaultActiveKey={['1', '2', '3', '4']} ghost bigger>
        <Collapse.Panel header={t('Recents')} key="1">
          <ActivityTable
            user={user}
            activeChild={activeChild}
            setActiveChild={setActiveChild}
            loading={loading}
            activityData={activityData}
          />
        </Collapse.Panel>
        <Collapse.Panel header={t('Dashboards')} key="2">
          {loading ? (
            <Loading position="inline" />
          ) : (
            <DashboardTable
              user={user}
              mine={activityData.myDash}
              isLoading={loading}
            />
          )}
        </Collapse.Panel>
        <Collapse.Panel header={t('Saved Queries')} key="3">
          {loading ? (
            <Loading position="inline" />
          ) : (
            <SavedQueries user={user} mine={activityData.myQuery} />
          )}
        </Collapse.Panel>
        <Collapse.Panel header={t('Charts')} key="4">
          {loading ? (
            <Loading position="inline" />
          ) : (
            <ChartTable user={user} mine={activityData.myChart} />
          )}
        </Collapse.Panel>
      </Collapse>
    </WelcomeContainer>
  );
}

export default withToasts(Welcome);
