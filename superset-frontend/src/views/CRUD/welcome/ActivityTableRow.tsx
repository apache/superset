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
import moment from 'moment';
import ListViewCard from 'src/components/ListViewCard';
import { CardStyles } from '../utils';

interface ActivityObjects {
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
  activeChild: string;
  loading: boolean;
  activityList: ActivityObjects[];
}

const getRecentRef = (activeChild: string, activity: ActivityObjects) => {
  if (activeChild === 'Viewed') {
    return activity.item_url;
  }
  return activity.sql
    ? `/superset/sqllab?savedQueryId=${activity.id}`
    : activity.url;
};
const getFilterTitle = (activity: ActivityObjects) => {
  if (activity.dashboard_title) return activity.dashboard_title;
  if (activity.label) return activity.label;
  if (activity.url && !activity.table) return activity.item_title;
  if (activity.item_title) return activity.item_title;
  return activity.slice_name;
};

const getIconName = (activity: ActivityObjects) => {
  if (activity.sql) return 'sql';
  if (
    activity.url?.includes('dashboard') ||
    activity.item_url?.includes('dashboard')
  ) {
    return 'nav-dashboard';
  }
  if (
    activity.url?.includes('explore') ||
    activity.item_url?.includes('explore')
  ) {
    return 'nav-charts';
  }
  return '';
};

const ActivityTableRow: React.FC<ActivityProps> = ({
  loading,
  activeChild,
  activityList,
}) => (
  <>
    {activityList.map(activity => (
      <CardStyles
        key={`${activity.item_title}__${activity.time}`}
        onClick={() => {
          window.location.href = getRecentRef(activeChild, activity);
        }}
      >
        <ListViewCard
          loading={loading}
          cover={<></>}
          url={
            activity.sql
              ? `/superset/sqllab?savedQueryId=${activity.id}`
              : activity.url
          }
          title={getFilterTitle(activity)}
          description={`Last Edited: ${moment(
            activity.changed_on_utc,
            'MM/DD/YYYY HH:mm:ss',
          )}`}
          avatar={getIconName(activity)}
          actions={null}
        />
      </CardStyles>
    ))}
  </>
);

export default ActivityTableRow;
