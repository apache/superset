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
import { t } from '@superset-ui/core';
import rison from 'rison';
import TableLoader from 'src/components/TableLoader';
import { BootstrapUser } from 'src/types/bootstrapTypes';
import { ActivityResult } from './types';

interface RecentActivityProps {
  user: BootstrapUser;
}

export default function RecentActivity({ user }: RecentActivityProps) {
  const rowLimit = 50;
  const mutator = function (data: ActivityResult) {
    return data.result
      .filter(row => row.action === 'dashboard' || row.action === 'explore')
      .map(row => ({
        name: <a href={row.item_url}>{row.item_title}</a>,
        type: row.action,
        time: moment.utc(row.time).fromNow(),
        _time: row.time,
      }));
  };
  const params = rison.encode({ page_size: rowLimit });
  return (
    <div>
      <TableLoader
        className="table-condensed"
        mutator={mutator}
        sortable
        dataEndpoint={`/api/v1/log/recent_activity/?q=${params}`}
        noDataText={t('No Data')}
      />
    </div>
  );
}
