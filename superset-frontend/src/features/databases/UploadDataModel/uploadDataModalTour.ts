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
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { t } from '@apache-superset/core';

export type UploadType = 'csv' | 'excel' | 'columnar';

function getTourSteps(type: UploadType): DriveStep[] {
  const scope = `[data-tour="upload-modal-${type}"]`;
  return [
    {
      element: `${scope} [data-tour="upload-file-dropzone-${type}"]`,
      popover: {
        title: t('Upload your file'),
        description: t(
          'Drag and drop your file here or click Select to browse. Supported formats: CSV, Excel, or Columnar (Parquet).',
        ),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: `${scope} [data-tour="upload-preview-${type}"]`,
      popover: {
        title: t('Preview columns'),
        description: t(
          'Toggle to preview the columns from your uploaded file. The column names will appear here once a file is selected.',
        ),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: `${scope} [data-tour="upload-database-${type}"]`,
      popover: {
        title: t('Select database'),
        description: t(
          'Choose the database where you want to store the uploaded data.',
        ),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: `${scope} [data-tour="upload-table-name-${type}"]`,
      popover: {
        title: t('Table name'),
        description: t(
          'Enter a name for the new table that will be created from your uploaded file.',
        ),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: `${scope} [data-tour="upload-submit-button-${type}"]`,
      popover: {
        title: t('Upload'),
        description: t(
          'Click Upload to import your data. Make sure you have selected a file, database, and entered a table name.',
        ),
        side: 'top',
        align: 'center',
      },
    },
  ];
}

export function startUploadDataModalTour(type: UploadType): void {
  const driverObj = driver({
    animate: false,
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    progressText: t('{{current}} of {{total}}'),
    nextBtnText: t('Next'),
    prevBtnText: t('Previous'),
    doneBtnText: t('Done'),
    steps: getTourSteps(type),
  });

  driverObj.drive();
}
