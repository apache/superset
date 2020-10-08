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
  url: string;
  sql: string;
  dashboard_title: string;
  label: string;
  id: string;
  table: object;
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
  // this API uses Log for data which in some cases is can be empty
  // const recent = `/superset/recent_activity/${user.userId}/?limit=5`;
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

  const setBatchData = (q: string, created?: string) => {
    createBatchMethod(q, created)
      .then((res: Array<object>) =>
        // @ts-ignore
        setActiveState(res),
      )
      .catch(() => addDangerToast('Oops something went wrong'));
  };

  const getFilterTitle = (e: MapProps) => {
    if (e.dashboard_title) return e.dashboard_title;
    if (e.label) return e.label;
    if (e.url && !e.table) return e.item_title;
    return e.slice_name;
  };

  const getIconName = (e: MapProps) => {
    if (e.sql) return 'sql';
    if (e.url.indexOf('dashboard') !== -1) {
      return 'nav-dashboard';
    }
    if (e.url.indexOf('explore') !== -1) {
      return 'nav-charts';
    }
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
    if (activityFilter === 'Edited') {
      setBatchData(queryParams);
    }
    if (activityFilter === 'Created') {
      setBatchData(queryParams, 'createdBy');
    }
  };

  useEffect(() => {
    getData();
  }, [activityFilter]);

  const renderActivity = () => {
    return active.map((e: MapProps, i) => (
      <ListViewCard
        key={`${i}`}
        isRecent
        loading={loading}
        imgURL=""
        imgFallbackURL=""
        url={e.sql ? `/supserset/sqllab?queryId=${e.id}` : e.url}
        title={getFilterTitle(e)}
        description={moment.utc(e.changed_on_utc).fromNow()}
        avatar={getIconName(e)}
        actions={null}
      />
    ));
  };

  return <> {renderActivity()} </>;
}
