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
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { DatasetObject } from '../types';

interface FooterObject {
  url: string;
  datasetObject?: Partial<DatasetObject> | null;
}

export default function Footer({ url, datasetObject }: FooterObject) {
  const { createResource } = useSingleViewResource<Partial<DatasetObject>>(
    'dataset',
    t('dataset'),
    addDangerToast,
  );
  const cancelButtonOnClick = () => {
    // this is a placeholder url until the final feature gets implemented
    // at that point we will be passing in the url of the previous location.
    window.location.href = url;
  };

  const tooltipText = t('Select a database table.');

  const onSave = () => {
    if (datasetObject) {
      createResource(datasetObject).then(response => {
        if (!response) {
          return;
        }
      });
      cancelButtonOnClick();
    }
  };

  return (
    <>
      <Button onClick={cancelButtonOnClick}>Cancel</Button>
      <Button
        buttonStyle="primary"
        disabled={!datasetObject?.table_name}
        tooltip={!datasetObject?.table_name ? tooltipText : undefined}
        onClick={onSave}
      >
        Create Dataset
      </Button>
    </>
  );
}
