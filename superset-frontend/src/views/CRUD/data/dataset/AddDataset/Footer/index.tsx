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
import Button from 'src/components/Button';
import { t } from '@superset-ui/core';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { logEvent } from 'src/logger/actions';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  LOG_ACTIONS_DATASET_CREATION_EMPTY_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_DATABASE_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_SCHEMA_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_TABLE_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_SUCCESS,
} from 'src/logger/LogUtils';
import { DatasetObject } from '../types';

interface FooterProps {
  url: string;
  addDangerToast: () => void;
  datasetObject?: Partial<DatasetObject> | null;
  onDatasetAdd?: (dataset: DatasetObject) => void;
  hasColumns?: boolean;
}

const INPUT_FIELDS = ['db', 'schema', 'table_name'];
const LOG_ACTIONS = [
  LOG_ACTIONS_DATASET_CREATION_EMPTY_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_DATABASE_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_SCHEMA_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_TABLE_CANCELLATION,
];

function Footer({
  url,
  datasetObject,
  addDangerToast,
  hasColumns = false,
}: FooterProps) {
  const { createResource } = useSingleViewResource<Partial<DatasetObject>>(
    'dataset',
    t('dataset'),
    addDangerToast,
  );

  const createLogAction = (dataset: Partial<DatasetObject>) => {
    let totalCount = 0;
    const value = Object.keys(dataset).reduce((total, key) => {
      if (INPUT_FIELDS.includes(key) && dataset[key]) {
        totalCount += 1;
      }
      return totalCount;
    }, 0);

    return LOG_ACTIONS[value];
  };
  const goToPreviousUrl = () => {
    // this is a placeholder url until the final feature gets implemented
    // at that point we will be passing in the url of the previous location.
    window.location.href = url;
  };

  const cancelButtonOnClick = () => {
    if (!datasetObject) {
      logEvent(LOG_ACTIONS_DATASET_CREATION_EMPTY_CANCELLATION, {});
    } else {
      const logAction = createLogAction(datasetObject);
      logEvent(logAction, datasetObject);
    }
    goToPreviousUrl();
  };

  const tooltipText = t('Select a database table.');

  const onSave = () => {
    if (datasetObject) {
      const data = {
        database: datasetObject.db?.id,
        schema: datasetObject.schema,
        table_name: datasetObject.table_name,
      };
      createResource(data).then(response => {
        if (!response) {
          return;
        }
        if (typeof response === 'number') {
          logEvent(LOG_ACTIONS_DATASET_CREATION_SUCCESS, datasetObject);
          // When a dataset is created the response we get is its ID number
          goToPreviousUrl();
        }
      });
    }
  };

  return (
    <>
      <Button onClick={cancelButtonOnClick}>Cancel</Button>
      <Button
        buttonStyle="primary"
        disabled={!datasetObject?.table_name || !hasColumns}
        tooltip={!datasetObject?.table_name ? tooltipText : undefined}
        onClick={onSave}
      >
        {t('Create Dataset')}
      </Button>
    </>
  );
}

export default withToasts(Footer);
