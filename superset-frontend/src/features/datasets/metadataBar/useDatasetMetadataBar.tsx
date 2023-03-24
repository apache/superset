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
import React, { useMemo } from 'react';
import { css, t, useTheme } from '@superset-ui/core';
import Alert from 'src/components/Alert';
import { useApiV1Resource } from 'src/hooks/apiResources';
import { Dataset } from 'src/components/Chart/DrillDetail/types';
import MetadataBar from 'src/components/MetadataBar';
import {
  ContentType,
  MetadataType,
} from 'src/components/MetadataBar/ContentType';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';

export const useDatasetMetadataBar = (datasetId: number | string) => {
  const theme = useTheme();
  const response = useApiV1Resource<Dataset>(`/api/v1/dataset/${datasetId}`);

  const { status, result } = response;

  const metadataBar = useMemo(() => {
    const items: ContentType[] = [];
    if (result) {
      const {
        changed_on_humanized,
        created_on_humanized,
        description,
        table_name,
        changed_by,
        created_by,
        owners,
      } = result;
      const notAvailable = t('Not available');
      const createdBy =
        `${created_by?.first_name ?? ''} ${
          created_by?.last_name ?? ''
        }`.trim() || notAvailable;
      const modifiedBy = changed_by
        ? `${changed_by.first_name} ${changed_by.last_name}`
        : notAvailable;
      const formattedOwners =
        owners?.length > 0
          ? owners.map(owner => `${owner.first_name} ${owner.last_name}`)
          : [notAvailable];
      items.push({
        type: MetadataType.TABLE,
        title: table_name,
      });
      items.push({
        type: MetadataType.LAST_MODIFIED,
        value: changed_on_humanized,
        modifiedBy,
      });
      items.push({
        type: MetadataType.OWNER,
        createdBy,
        owners: formattedOwners,
        createdOn: created_on_humanized,
      });
      if (description) {
        items.push({
          type: MetadataType.DESCRIPTION,
          value: description,
        });
      }
    }
    return (
      <div
        css={css`
          display: flex;
          margin-bottom: ${theme.gridUnit * 4}px;
        `}
      >
        {status === ResourceStatus.COMPLETE && (
          <MetadataBar items={items} tooltipPlacement="bottom" />
        )}
        {status === ResourceStatus.ERROR && (
          <Alert
            type="error"
            message={t('There was an error loading the dataset metadata')}
          />
        )}
      </div>
    );
  }, [result, status, theme.gridUnit]);

  return {
    metadataBar,
    status,
  };
};
