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
import { render, waitFor } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import DatasetPanelWrapper from 'src/features/datasets/AddDataset/DatasetPanel';

jest.mock(
  '@superset-ui/core/components/Icons/AsyncIcon',
  () =>
    ({ fileName }: { fileName: string }) => (
      <span role="img" aria-label={fileName.replace('_', '-')} />
    ),
);

afterEach(() => {
  jest.restoreAllMocks();
});

test('fetches table metadata for schema-less database without schema', async () => {
  const getSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      name: 'my_table',
      columns: [{ name: 'id', type: 'INTEGER', longType: 'INTEGER' }],
    },
  } as any);

  render(
    <DatasetPanelWrapper
      tableName="my_table"
      dbId={1}
      database={{ supports_schemas: false }}
    />,
    { useRouter: true },
  );

  await waitFor(() => {
    expect(getSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expect.stringContaining('/api/v1/database/1/table_metadata/'),
      }),
    );
  });
});
