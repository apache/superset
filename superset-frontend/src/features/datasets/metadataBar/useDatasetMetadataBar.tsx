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
import { css, t, useTheme } from '@superset-ui/core';
import { Dataset } from 'src/components/Chart/types';
import MetadataBar from '@superset-ui/core/components/MetadataBar';
import {
  ContentType,
  MetadataType,
} from '@superset-ui/core/components/MetadataBar/ContentType';
import { isEmbedded } from 'src/dashboard/util/isEmbedded';

export interface UseDatasetMetadataBarProps {
  dataset?: Dataset;
}

export const useDatasetMetadataBar = ({
  dataset,
}: UseDatasetMetadataBarProps): { metadataBar: React.ReactElement | null } => {
  const theme = useTheme();

  const metadataBar = useMemo(() => {
    // Short-circuit for embedded users - they don't need metadata bar
    if (isEmbedded()) {
      return null;
    }
    const items: ContentType[] = [];
    if (dataset) {
      const {
        changed_on_humanized,
        created_on_humanized,
        description,
        table_name,
        changed_by,
        created_by,
        owners,
      } = dataset;
      const notAvailable = t('Not available');
      const createdBy =
        `${created_by?.first_name ?? ''} ${
          created_by?.last_name ?? ''
        }`.trim() || notAvailable;
      const modifiedBy = changed_by
        ? `${changed_by.first_name} ${changed_by.last_name}`
        : notAvailable;
      const formattedOwners =
        owners && owners.length > 0
          ? owners.map(owner => `${owner.first_name} ${owner.last_name}`)
          : [notAvailable];
      items.push({
        type: MetadataType.Table,
        title: table_name || notAvailable,
      });
      items.push({
        type: MetadataType.LastModified,
        value: changed_on_humanized || notAvailable,
        modifiedBy,
      });
      items.push({
        type: MetadataType.Owner,
        createdBy,
        owners: formattedOwners,
        createdOn: created_on_humanized || notAvailable,
      });
      if (description) {
        items.push({
          type: MetadataType.Description,
          value: description,
        });
      }
    }
    return (
      <div
        css={css`
          display: flex;
          margin-bottom: ${theme.sizeUnit * 4}px;
        `}
      >
        {items.length > 0 && (
          <MetadataBar items={items} tooltipPlacement="bottom" />
        )}
      </div>
    );
  }, [dataset, theme.sizeUnit]);

  return {
    metadataBar,
  };
};
