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
import fetchMock from 'fetch-mock';
import { Route } from 'react-router-dom';
import { render, screen } from 'spec/helpers/testing-library';
import { COLUMN_LAYOUT_PRESETS } from '@superset-ui/core/components/TableCollection';
import { mockListViewContainerWidth } from 'spec/helpers/listViewColumnWidths';
import AnnotationList from 'src/pages/AnnotationList';

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.restoreAllMocks();
});

test('start and end dates use the short date width', async () => {
  mockListViewContainerWidth(1440);
  window.history.pushState({}, '', '/annotationlayer/1/annotation/');
  fetchMock.get('glob:*/api/v1/annotation_layer/1', {
    id: 1,
    result: { id: 1, name: 'Releases', descr: '' },
  });
  fetchMock.get('glob:*/api/v1/annotation_layer/1/annotation/_info*', {
    permissions: ['can_write'],
  });
  fetchMock.get('glob:*/api/v1/annotation_layer/1/annotation/?q=*', {
    count: 1,
    ids: [1],
    result: [
      {
        id: 1,
        short_descr: 'Release 1',
        long_descr: 'Major release',
        start_dttm: '2026-10-29T10:00:00',
        end_dttm: '2026-10-30T10:00:00',
        changed_on_delta_humanized: '1 hour ago',
      },
    ],
  });
  render(
    <Route path="/annotationlayer/:annotationLayerId/annotation/">
      <AnnotationList />
    </Route>,
    { useRedux: true, useRouter: true, useQueryParams: true },
  );
  await screen.findByText('Release 1');

  const table = screen.getByTestId('listview-table').querySelector('table')!;
  const headers = Array.from(table.querySelectorAll('thead th')).map(
    th => th.textContent?.trim() ?? '',
  );
  const widths = Array.from(table.querySelectorAll('colgroup col')).map(col =>
    parseInt((col as HTMLElement).style.width, 10),
  );
  const { fixed } = COLUMN_LAYOUT_PRESETS.dateRelative as { fixed: number };
  expect(widths[headers.indexOf('Start')]).toBe(fixed);
  expect(widths[headers.indexOf('End')]).toBe(fixed);
});
