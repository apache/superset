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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import WithQuery from './WithQuery';
import { CanvasDraftContext } from './useWidgetRows';

test('shows the query that ran from the chart menu', async () => {
  // The query panel formats the query through SQL Lab when it opens.
  fetchMock.get('glob:*/api/v1/dataset/13?**', {
    result: { database: { backend: 'sqlite' } },
  });
  fetchMock.post('glob:*/api/v1/sqllab/format_sql/', {
    result: 'SELECT country\nFROM sales',
  });
  render(
    <WithQuery
      query="SELECT country FROM sales"
      language="sql"
      datasource="13__table"
    >
      <div>chart</div>
    </WithQuery>,
    { useRedux: true, useRouter: true },
  );

  await userEvent.click(screen.getByRole('button', { name: 'More Options' }));
  await userEvent.click(await screen.findByText('View query'));

  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog).toHaveTextContent('FROM sales'));
  expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
  fetchMock.removeRoutes();
});

test('offers nothing when the user may not see the query', () => {
  render(
    <WithQuery>
      <div>chart</div>
    </WithQuery>,
  );

  expect(screen.getByText('chart')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'More Options' })).toBeNull();
});

test("the chart menu steps aside for the layout's corner handle in a plan", () => {
  // In a plan the top right corner belongs to the resize handle, which sits
  // above these controls in the stack. Without the inset it would either hide
  // under them or have to be moved out of the corner, where it stops matching
  // the other three.
  const menu = (draftToken?: string) => {
    const { container, unmount } = render(
      <CanvasDraftContext.Provider value={draftToken}>
        <WithQuery query="SELECT 1" language="sql" datasource="13__table">
          <div>chart</div>
        </WithQuery>
      </CanvasDraftContext.Provider>,
      { useRedux: true, useRouter: true },
    );
    const { right } = getComputedStyle(
      container.querySelector('.canvas-widget-controls') as HTMLElement,
    );
    unmount();
    return right;
  };

  expect(menu(undefined)).toBe('0px');
  expect(menu('tok-123')).toBe('20px');
});
