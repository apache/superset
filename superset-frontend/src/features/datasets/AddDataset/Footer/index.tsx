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
import { useHistory } from 'react-router-dom';
import Button from 'src/components/Button';
import { Icons } from 'src/components/Icons';
import { Menu } from 'src/components/Menu';
import { DropdownButton } from 'src/components/DropdownButton';
import { t, useTheme } from '@superset-ui/core';
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
  datasets?: (string | null | undefined)[] | undefined;
}

const INPUT_FIELDS = ['db', 'schema', 'table_name'];
const LOG_ACTIONS = [
  LOG_ACTIONS_DATASET_CREATION_EMPTY_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_DATABASE_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_SCHEMA_CANCELLATION,
  LOG_ACTIONS_DATASET_CREATION_TABLE_CANCELLATION,
];

function Footer({
  datasetObject,
  addDangerToast,
  hasColumns = false,
  datasets,
}: FooterProps) {
  const history = useHistory();
  const { createResource } = useSingleViewResource<Partial<DatasetObject>>(
    'dataset',
    t('dataset'),
    addDangerToast,
  );

  const createLogAction = (dataset: Partial<DatasetObject>) => {
    let totalCount = 0;
    const value = Object.keys(dataset).reduce((total, key) => {
      if (INPUT_FIELDS.includes(key) && dataset[key as keyof DatasetObject]) {
        totalCount += 1;
      }
      return totalCount;
    }, 0);

    return LOG_ACTIONS[value];
  };

  const cancelButtonOnClick = () => {
    if (!datasetObject) {
      logEvent(LOG_ACTIONS_DATASET_CREATION_EMPTY_CANCELLATION, {});
    } else {
      const logAction = createLogAction(datasetObject);
      logEvent(logAction, datasetObject);
    }
    history.goBack();
  };

  const tooltipText = t('Select a database table.');

  const onSave = (chartRedirect = true) => {
    if (datasetObject) {
      const data = {
        database: datasetObject.db?.id,
        catalog: datasetObject.catalog,
        schema: datasetObject.schema,
        table_name: datasetObject.table_name,
      };
      createResource(data).then(response => {
        if (!response) {
          return;
        }
        if (typeof response === 'number' && chartRedirect) {
          logEvent(LOG_ACTIONS_DATASET_CREATION_SUCCESS, datasetObject);
          // When a dataset is created the response we get is its ID number
          history.push(`/chart/add/?dataset=${datasetObject.table_name}`);
        } else {
          history.push('/tablemodelview/list/');
        }
      });
    }
  };

  const onSaveDatasetOnly = () => {
    onSave(false);
  };

  const CREATE_DATASET_AND_CHART_TEXT = t('Create dataset and create chart');
  const CREATE_DATASET_TEXT = t('Only create dataset');

  const disabledCheck =
    !datasetObject?.table_name ||
    !hasColumns ||
    datasets?.includes(datasetObject?.table_name);

  const overlayMenu = (
    <Menu>
      <Menu.Item onClick={onSaveDatasetOnly}>{CREATE_DATASET_TEXT}</Menu.Item>
    </Menu>
  );

  const theme = useTheme();

  return (
    <>
      <Button onClick={cancelButtonOnClick}>{t('Cancel')}</Button>
      <DropdownButton
        onClick={onSave}
        dropdownRender={() => overlayMenu}
        icon={
          <Icons.DownOutlined
            iconSize="xs"
            iconColor={theme.colors.primary.dark2}
          />
        }
        trigger={['click']}
        disabled={disabledCheck}
        tooltip={!datasetObject?.table_name ? tooltipText : undefined}
      >
        {CREATE_DATASET_AND_CHART_TEXT}
      </DropdownButton>
    </>
  );
}

export default withToasts(Footer);
