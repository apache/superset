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
import { dashboard as dashboardApi } from '@apache-superset/core';
import DashboardProvider from './DashboardProvider';
import { getActiveFiltersForDataset } from './collectActiveFilters';

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
});

const DATASET_ID = 1;

/** A resolved EQUALS constraint, the shape any source — filter.select, a cross-filtering chart, or otherwise — publishes. */
const resolvedEquals = (
  column: string,
  value: string,
  datasource = DATASET_ID,
) => ({
  selection: value,
  resolved: { column, operator: 'EQUALS' as const, value, datasource },
});

test('a node is a filter source purely by publishing a resolved value, regardless of its type', () => {
  const rootId = provider.getRoot().id;
  // An arbitrary, non-'filter.*' type — nothing about this test relies on
  // any built-in widget type at all, since the whole point is that
  // collectActiveFilters.ts never inspects `type`.
  const sourceId = provider.addWidget(rootId, 0, { type: 'echarts' });
  const consumerId = provider.addWidget(rootId, 1, { type: 'echarts' });

  provider.emit(
    sourceId,
    dashboardApi.VALUE_CHANGED_EVENT,
    resolvedEquals('region', 'west'),
  );

  expect(getActiveFiltersForDataset(DATASET_ID, consumerId)).toEqual([
    {
      expressionType: 'SIMPLE',
      subject: 'region',
      clause: 'WHERE',
      operator: '==',
      comparator: 'west',
    },
  ]);
});

test('a node with no resolved value yet is not a filter source', () => {
  const rootId = provider.getRoot().id;
  provider.addWidget(rootId, 0, { type: 'echarts' });
  const consumerId = provider.addWidget(rootId, 1, { type: 'echarts' });

  expect(getActiveFiltersForDataset(DATASET_ID, consumerId)).toEqual([]);
});

test("scope defaults to the resolved value's own datasource, not an authored prop", () => {
  const rootId = provider.getRoot().id;
  const sourceId = provider.addWidget(rootId, 0, {
    type: 'echarts',
    // Deliberately a different dataset in props than in the resolved
    // value — the resolved value is what's authoritative.
    props: { dataBinding: { datasetId: 999 } },
  });
  const consumerId = provider.addWidget(rootId, 1, { type: 'echarts' });

  provider.emit(
    sourceId,
    dashboardApi.VALUE_CHANGED_EVENT,
    resolvedEquals('region', 'west', DATASET_ID),
  );

  expect(getActiveFiltersForDataset(DATASET_ID, consumerId)).toHaveLength(1);
  expect(getActiveFiltersForDataset(999, consumerId)).toEqual([]);
});

test('a source never applies to itself, even if it targets its own dataset', () => {
  const rootId = provider.getRoot().id;
  const sourceId = provider.addWidget(rootId, 0, { type: 'echarts' });

  provider.emit(
    sourceId,
    dashboardApi.VALUE_CHANGED_EVENT,
    resolvedEquals('region', 'west'),
  );

  // A chart cross-filtering on its own click must not narrow its own next
  // fetch down to the point that was just clicked.
  expect(getActiveFiltersForDataset(DATASET_ID, sourceId)).toEqual([]);
});

test('an explicit scope.targets list overrides the dataset-match default, for any node type', () => {
  const rootId = provider.getRoot().id;
  const sourceId = provider.addWidget(rootId, 0, { type: 'echarts' });
  const targetedConsumerId = provider.addWidget(rootId, 1, { type: 'echarts' });
  const otherConsumerId = provider.addWidget(rootId, 2, { type: 'echarts' });

  provider.updateProps(sourceId, { scope: { targets: [targetedConsumerId] } });
  provider.emit(
    sourceId,
    dashboardApi.VALUE_CHANGED_EVENT,
    resolvedEquals('region', 'west'),
  );

  expect(
    getActiveFiltersForDataset(DATASET_ID, targetedConsumerId),
  ).toHaveLength(1);
  // Same dataset, but not in the explicit target list — scope replaces
  // the dataset-match default rather than adding to it.
  expect(getActiveFiltersForDataset(DATASET_ID, otherConsumerId)).toEqual([]);
});

test('an empty scope.targets array is still the dataset-match default, not "target nobody"', () => {
  // `FilterScope.targets` defaults to `[]` on the backend (see its own
  // docstring), and JsonForms can write that empty default into `props`
  // without the author ever touching the Scope field — `[]` must not be
  // mistaken for an explicit "no targets" override, or a filter would
  // silently stop reaching any same-dataset consumer the moment its
  // Inspector form was ever opened.
  const rootId = provider.getRoot().id;
  const sourceId = provider.addWidget(rootId, 0, {
    type: 'filter.select',
    props: { datasetId: DATASET_ID, column: 'region', scope: { targets: [] } },
  });
  const consumerId = provider.addWidget(rootId, 1, { type: 'echarts' });

  provider.emit(
    sourceId,
    dashboardApi.VALUE_CHANGED_EVENT,
    resolvedEquals('region', 'west'),
  );

  expect(getActiveFiltersForDataset(DATASET_ID, consumerId)).toHaveLength(1);
});

test('a scope.targets array holding only a blank string is also the dataset-match default', () => {
  // The real shape seen in practice: the generic Form control for
  // `FilterScope.targets` (a plain string array with no `items.enum`) seeds
  // one empty-string row the instant the Scope section renders — so an
  // author who never touched Scope still ends up with `["")]`, not `[]`.
  // That blank entry must not be mistaken for a real target id either.
  const rootId = provider.getRoot().id;
  const sourceId = provider.addWidget(rootId, 0, {
    type: 'filter.select',
    props: {
      datasetId: DATASET_ID,
      column: 'region',
      scope: { targets: [''] },
    },
  });
  const consumerId = provider.addWidget(rootId, 1, { type: 'echarts' });

  provider.emit(
    sourceId,
    dashboardApi.VALUE_CHANGED_EVENT,
    resolvedEquals('region', 'west'),
  );

  expect(getActiveFiltersForDataset(DATASET_ID, consumerId)).toHaveLength(1);
});

test('a filter.select source still works exactly as before this generalization', () => {
  const rootId = provider.getRoot().id;
  const filterId = provider.addWidget(rootId, 0, {
    type: 'filter.select',
    props: { datasetId: DATASET_ID, column: 'region' },
  });
  const consumerId = provider.addWidget(rootId, 1, { type: 'echarts' });

  provider.emit(
    filterId,
    dashboardApi.VALUE_CHANGED_EVENT,
    resolvedEquals('region', 'west'),
  );

  expect(getActiveFiltersForDataset(DATASET_ID, consumerId)).toHaveLength(1);
});
