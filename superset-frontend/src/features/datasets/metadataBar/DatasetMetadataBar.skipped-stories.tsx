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
import { useResizeDetector } from 'react-resize-detector';
import { css, SupersetClient } from '@superset-ui/core';
import { useDatasetMetadataBar } from './useDatasetMetadataBar';

export default {
  title: 'Design System/Components/MetadataBar/Examples',
  parameters: {
    mockData: [
      {
        url: '/api/v1/dataset/1',
        method: 'GET',
        status: 200,
        response: {
          result: {
            changed_on: '2023-01-26T12:06:58.733316',
            changed_on_humanized: 'a month ago',
            changed_by: { first_name: 'Han', last_name: 'Solo' },
            created_by: { first_name: 'Luke', last_name: 'Skywalker' },
            created_on: '2023-01-26T12:06:54.965034',
            created_on_humanized: 'a month ago',
            table_name: `This is dataset's name`,
            owners: [
              { first_name: 'John', last_name: 'Doe' },
              { first_name: 'Luke', last_name: 'Skywalker' },
            ],
            description: 'This is a dataset description',
          },
        },
      },
    ],
  },
};

export const DatasetSpecific = () => {
  SupersetClient.reset();
  SupersetClient.configure({ csrfToken: '1234' }).init();
  const { metadataBar } = useDatasetMetadataBar({ datasetId: 1 });
  const { width, height, ref } = useResizeDetector();
  // eslint-disable-next-line no-param-reassign
  return (
    <div
      ref={ref}
      css={css`
        margin-top: 70px;
        margin-left: 80px;
        overflow: auto;
        min-width: ${168}px;
        max-width: ${740}px;
        resize: horizontal;
      `}
    >
      {metadataBar}
      <span
        css={css`
          position: absolute;
          top: 150px;
          left: 115px;
        `}
      >{`${width}x${height}`}</span>
    </div>
  );
};
