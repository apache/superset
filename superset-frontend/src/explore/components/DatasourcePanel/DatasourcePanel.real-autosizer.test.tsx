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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { DatasourceType } from '@superset-ui/core';
import DatasourcePanel, {
  IDatasource,
} from 'src/explore/components/DatasourcePanel';
import {
  columns,
  metrics,
} from 'src/explore/components/DatasourcePanel/fixtures';
import ExploreContainer from 'src/explore/components/ExploreContainer';
import { DndMetricSelect } from 'src/explore/components/controls/DndColumnSelectControl';
import DatasourceControl from 'src/explore/components/controls/DatasourceControl';

/**
 * DatasourcePanel.test.tsx mocks react-virtualized-auto-sizer to a fixed
 * height, which bypasses react-window's own size self-measurement path
 * entirely. This test instead drives a real ResizeObserver callback so the
 * panel renders through the same AutoSizer -> react-window List pipeline
 * the browser uses, to guard against regressions like
 * https://github.com/apache/superset/issues/43008.
 */
class FakeResizeObserver {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    Object.defineProperty(target, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: 300,
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
    });
    setTimeout(() => {
      this.callback(
        [
          {
            target,
            contentRect: { width: 300, height: 600 },
          } as ResizeObserverEntry,
        ],
        this,
      );
    }, 0);
  }

  unobserve() {}

  disconnect() {}
}

const originalResizeObserver = window.ResizeObserver;

beforeEach(() => {
  window.ResizeObserver = FakeResizeObserver;
});

afterEach(() => {
  window.ResizeObserver = originalResizeObserver;
});

const datasource: IDatasource = {
  id: 1,
  type: DatasourceType.Table,
  columns,
  metrics,
  database: { id: 1 },
  datasource_name: 'table1',
};

test('renders metrics and columns through the real (unmocked) AutoSizer + react-window List pipeline', async () => {
  render(
    <ExploreContainer>
      <DatasourcePanel
        datasource={datasource}
        controls={{
          datasource: {
            validationErrors: null,
            mapStateToProps: () => ({ value: undefined }),
            type: DatasourceControl,
            label: 'Datasource',
            datasource,
          },
        }}
        actions={{ setControlValue: jest.fn() }}
        width={300}
      />
      <DndMetricSelect savedMetrics={[]} columns={[]} onChange={jest.fn()} />
    </ExploreContainer>,
    { useDnd: true, useRedux: true },
  );

  await waitFor(
    () => {
      expect(screen.getByText(metrics[0].metric_name)).toBeInTheDocument();
    },
    { timeout: 3000 },
  );
  expect(screen.getByText(columns[0].column_name)).toBeInTheDocument();
});
