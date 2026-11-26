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
import { t } from '@apache-superset/core/translation';
import type { TourStepProps } from '@superset-ui/core/components';

export type UploadType = 'csv' | 'excel' | 'columnar';

type TourTarget =
  | 'file-dropzone'
  | 'preview'
  | 'database'
  | 'table-name'
  | 'submit-button';

interface TourStepDefinition {
  target: TourTarget;
  title: string;
  description: string;
  placement: TourStepProps['placement'];
}

/**
 * Selector for a tour target, scoped to the upload modal of the given type
 * so the right element is found when several upload modals are mounted.
 */
export const getTourTargetSelector = (type: UploadType, target: TourTarget) =>
  `[data-tour="upload-modal-${type}"] [data-tour="upload-${target}-${type}"]`;

const getStepDefinitions = (): TourStepDefinition[] => [
  {
    target: 'file-dropzone',
    title: t('Upload your file'),
    description: t(
      'Drag and drop your file here or click Select to browse. Supported formats: CSV, Excel, or Columnar (Parquet).',
    ),
    placement: 'bottom',
  },
  {
    target: 'preview',
    title: t('Preview columns'),
    description: t(
      'Toggle to preview the columns from your uploaded file. The column names will appear here once a file is selected.',
    ),
    placement: 'bottom',
  },
  {
    target: 'database',
    title: t('Select database'),
    description: t(
      'Choose the database where you want to store the uploaded data.',
    ),
    placement: 'bottom',
  },
  {
    target: 'table-name',
    title: t('Table name'),
    description: t(
      'Enter a name for the new table that will be created from your uploaded file.',
    ),
    placement: 'bottom',
  },
  {
    target: 'submit-button',
    title: t('Upload'),
    description: t(
      'Click Upload to import your data. Make sure you have selected a file, database, and entered a table name.',
    ),
    placement: 'top',
  },
];

/**
 * Steps for the upload modal tour. Targets are resolved lazily so each step
 * highlights the element that is rendered when the step is shown.
 */
export const getUploadDataModalTourSteps = (
  type: UploadType,
): TourStepProps[] =>
  getStepDefinitions().map(({ target, title, description, placement }) => ({
    title,
    description,
    placement,
    // antd's type requires an element, but it centers the step's popover
    // when the target isn't rendered, which is the behavior we want.
    target: () =>
      document.querySelector<HTMLElement>(
        getTourTargetSelector(type, target),
      ) as HTMLElement,
  }));
