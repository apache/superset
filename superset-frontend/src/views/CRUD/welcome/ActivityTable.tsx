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
import { SupersetClient, t } from '@superset-ui/core';
import rison from 'rison';
import moment from 'moment';
import ListViewCard from 'src/components/ListViewCard';
import { addDangerToast } from 'src/messageToasts/actions';
import { createBatchMethod, createErrorHandler } from '../utils';

interface MapProps {
  action?: string;
  item_title?: string;
  slice_name: string;
  time: string;
  changed_on_utc: string;
  item_url: string;
}

interface ActivityProps {
  user: {
    userId: string | number;
  };
  activityFilter: string;
}

export default function ActivityTable({ user, activityFilter }: ActivityProps) {
  const [active, setActiveState] = useState([]);
  const [loading, setLoading] = useState(false);
  const recent = `/superset/recent_activity/${user.userId}/?limit=5`;
  const filters = {
    // Chart and dashbaord uses same filters
    // for edited and created
    edited: [
      {
        col: 'changed_by',
        opr: 'rel_o_m',
        value: `${user.userId}`,
      },
    ],
    created: [
      {
        col: 'created_by',
        opr: 'rel_o_m',
        value: `${user.userId}`,
      },
    ],
  };

  const setData = (endpoint: string) => {
    setLoading(true);
    SupersetClient.get({ endpoint })
      .then(({ json }) => {
        setLoading(false);
        // @ts-ignore
        setActiveState(json);
      })
      .catch(() => {
        setLoading(false);
        createErrorHandler(() =>
          addDangerToast(t('There was an issue fetching your resource')),
        );
      });
  };

  const setBatchData = (q: string) => {
    // @ts-ignore
    createBatchMethod(q).then((res: Array<object>) => setActiveState(res));
  };

  const getIconName = (name: string | undefined) => {
    if (name === 'explore_json') return 'sql';
    if (name === 'dashboard') return 'nav-dashboard';
    if (name === 'log' || name === 'explore') return 'nav-charts';
    return '';
  };

  const getData = () => {
    const queryParams = rison.encode({
      order_column: 'changed_on_delta_humanized',
      order_direction: 'desc',
      page: 0,
      page_size: 0,
      filters: activityFilter !== 'Created' ? filters.edited : filters.created,
    });
    if (activityFilter === 'Viewed') {
      setData(recent);
    }
    if (activityFilter === 'Edited') {
      setBatchData(queryParams);
    }
    if (activityFilter === 'Created') {
      setBatchData(queryParams);
    }
  };

  useEffect(() => {
    getData();
  }, [activityFilter]);

  const renderActivity = () => {
    return active.map((e: MapProps) => (
      <ListViewCard
        isRecent
        loading={loading}
        imgURL={null}
        imgFallbackURL={null}
        url={e.item_url}
        title={activityFilter === 'Viewed' ? e.item_title : e.slice_name}
        description={moment
          .utc(activityFilter === 'Viewd' ? e.time : e.changed_on_utc)
          .fromNow()}
        avatar={getIconName(e.action)}
        actions={null}
      />
    ));
  };

  return <> {renderActivity()} </>;
}
