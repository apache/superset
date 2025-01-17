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
import { useMemo } from 'react';
import { t } from '@superset-ui/core';
import { DashboardInfo } from 'src/dashboard/types';
import MetadataBar, { MetadataType } from 'src/components/MetadataBar';
import getOwnerName from 'src/utils/getOwnerName';

export const useDashboardMetadataBar = (dashboardInfo: DashboardInfo) => {
  const items = useMemo(
    () => [
      {
        type: MetadataType.LastModified as const,
        value: dashboardInfo.changed_on_delta_humanized,
        modifiedBy:
          getOwnerName(dashboardInfo.changed_by) || t('Not available'),
      },
      {
        type: MetadataType.Owner as const,
        createdBy: getOwnerName(dashboardInfo.created_by) || t('Not available'),
        owners:
          dashboardInfo.owners.length > 0
            ? dashboardInfo.owners.map(getOwnerName)
            : t('None'),
        createdOn: dashboardInfo.created_on_delta_humanized,
      },
    ],
    [
      dashboardInfo.changed_by,
      dashboardInfo.changed_on_delta_humanized,
      dashboardInfo.created_by,
      dashboardInfo.created_on_delta_humanized,
      dashboardInfo.owners,
    ],
  );

  return <MetadataBar items={items} tooltipPlacement="bottom" />;
};
