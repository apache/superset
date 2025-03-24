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
import { t, tn } from '@superset-ui/core';
import MetadataBar, { MetadataType } from 'src/components/MetadataBar';
import { ExplorePageInitialData } from 'src/explore/types';

export const useExploreMetadataBar = (
  metadata: ExplorePageInitialData['metadata'],
  slice: ExplorePageInitialData['slice'],
) =>
  useMemo(() => {
    if (!metadata) {
      return null;
    }
    const items = [];
    if (metadata.dashboards) {
      items.push({
        type: MetadataType.Dashboards as const,
        title:
          metadata.dashboards.length > 0
            ? tn(
                'Added to 1 dashboard',
                'Added to %s dashboards',
                metadata.dashboards.length,
                metadata.dashboards.length,
              )
            : t('Not added to any dashboard'),
        description:
          metadata.dashboards.length > 0
            ? t(
                'You can preview the list of dashboards in the chart settings dropdown.',
              )
            : undefined,
      });
    }
    items.push({
      type: MetadataType.LastModified as const,
      value: metadata.changed_on_humanized,
      modifiedBy: metadata.changed_by || t('Not available'),
    });
    items.push({
      type: MetadataType.Owner as const,
      createdBy: metadata.created_by || t('Not available'),
      owners: metadata.owners.length > 0 ? metadata.owners : t('None'),
      createdOn: metadata.created_on_humanized,
    });
    if (slice?.description) {
      items.push({
        type: MetadataType.Description as const,
        value: slice?.description,
      });
    }
    return <MetadataBar items={items} tooltipPlacement="bottom" />;
  }, [metadata, slice?.description]);
