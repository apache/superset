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
import { CanvasWidgetChromeContext } from './widgetChrome';

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

test('the chart menu keeps clear of the widget edge, plan or not', () => {
  // Two things live at that edge. In a plan it is the layout's resize handle,
  // which sits above these controls in the stack and would hide under them.
  // Outside one it is the scrollbar, since these controls anchor to the
  // widget's box rather than to its content -- flush against the edge puts
  // the menu on top of the scrollbar on any widget that scrolls. One inset
  // covers both, so it does not depend on whether a plan is open.
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

  expect(menu(undefined)).toBe('20px');
  expect(menu('tok-123')).toBe('20px');
});

test('the controls anchor to the widget box, not to this frame', () => {
  // The frame sits inside the canvas's scrolling content box; the drag and
  // resize handles are siblings of that box. Positioning the frame would
  // anchor the controls to it, which matches the handles only while nothing
  // overflows -- give the widget a scrollbar and the two drift apart, and the
  // controls scroll away with the content. Static keeps their containing
  // block outside the scroll box, where the handles are.
  const { container } = render(
    <WithQuery query="SELECT 1" language="sql" datasource="13__table">
      <div>chart</div>
    </WithQuery>,
    { useRedux: true, useRouter: true },
  );

  const controls = container.querySelector(
    '.canvas-widget-controls',
  ) as HTMLElement;
  const frame = controls.parentElement as HTMLElement;

  // The frame holds the controls, so positioning it would make it their
  // containing block. Left alone, that role falls to the canvas's widget
  // wrapper, which is the box the handles are pinned to.
  expect(getComputedStyle(frame).position).not.toBe('relative');
  expect(getComputedStyle(frame).position).not.toBe('absolute');
});

test('the chart menu goes into the chrome node a canvas offers', () => {
  // Rendered in place, the menu sits inside the widget's content box -- which
  // scrolls, clips and is its own stacking context, so a table's sticky
  // header is painted over it. Given somewhere beside that box, it goes
  // there instead.
  const chrome = document.createElement('div');
  document.body.append(chrome);

  const { container } = render(
    <CanvasWidgetChromeContext.Provider value={chrome}>
      <WithQuery query="SELECT 1" language="sql" datasource="13__table">
        <div>chart</div>
      </WithQuery>
    </CanvasWidgetChromeContext.Provider>,
    { useRedux: true, useRouter: true },
  );

  expect(chrome.querySelector('.canvas-widget-controls')).not.toBeNull();
  expect(container.querySelector('.canvas-widget-controls')).toBeNull();
  // The widget's own content stays where it was.
  expect(screen.getByText('chart')).toBeInTheDocument();

  chrome.remove();
});
