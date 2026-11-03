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
import type { QueryFormData } from '@superset-ui/core';
import { hasProposedChart, proposedChartFormData } from './proposedChart';

const live = {
  viz_type: 'deck_grid',
  datasource: '1__table',
  slice_id: 1,
  row_limit: 1000,
} as unknown as QueryFormData;

/** What Explore's legacy save captures: the posted form data, in full. */
const captured = (params: Record<string, unknown>) => ({
  slice_name: 'Deck.gl Grid',
  params: JSON.stringify(params),
  viz_type: params.viz_type,
  datasource_id: 1,
  datasource_type: 'table',
});

test('the proposed controls are what the chart is drawn from', () => {
  const formData = proposedChartFormData(
    live,
    captured({ viz_type: 'deck_grid', datasource: '1__table', row_limit: 50 }),
  );

  expect(formData).toMatchObject({
    viz_type: 'deck_grid',
    datasource: '1__table',
    row_limit: 50,
  });
});

test('the preview is queried as an unsaved chart', () => {
  // Otherwise the reviewer's preview and what viewers are served share a
  // cache key on the live chart, and whichever ran last wins.
  const formData = proposedChartFormData(
    live,
    captured({ viz_type: 'deck_grid', slice_id: 1 }),
  );

  expect(formData?.slice_id).toBe(0);
});

test('a rename from Explore does not count as a new chart', () => {
  // The case that made this a `changed_fields` question. Explore's Save
  // posts every control on every save, so a rename's captured body carries
  // `params` in full and byte-identical to what is stored. Verified on a
  // running instance: changed_fields ['slice_name'], proposed carrying
  // params, viz_type, datasource_id and datasource_type.
  expect(hasProposedChart(['slice_name'])).toBe(false);
});

test.each([
  ['the controls', ['params']],
  ['only the chart type', ['viz_type']],
  ['only the dataset', ['datasource_id', 'datasource_type']],
  ['the query behind it', ['query_context']],
])('a change to %s is previewable', (_label, changed) => {
  expect(hasProposedChart(changed)).toBe(true);
});

test.each([
  ['a cache timeout', ['cache_timeout']],
  ['the owners', ['owners']],
  ['nothing at all', []],
  ['an unreadable response', undefined],
])('a change to %s is not', (_label, changed) => {
  expect(hasProposedChart(changed as string[] | undefined)).toBe(false);
});

test('a chart-type change that carries no params still previews', () => {
  // A REST PUT sends only what moved. Keying the preview on `params` meant
  // this change to the drawing got no preview at all.
  const formData = proposedChartFormData(live, { viz_type: 'table' });

  expect(formData).toMatchObject({
    viz_type: 'table',
    datasource: '1__table',
    row_limit: 1000,
    slice_id: 0,
  });
});

test('a payload narrower than the legacy save falls back to the live chart', () => {
  // A save through the REST API can send params alone.
  const formData = proposedChartFormData(live, {
    params: JSON.stringify({ row_limit: 10 }),
  });

  expect(formData).toMatchObject({
    viz_type: 'deck_grid',
    datasource: '1__table',
    row_limit: 10,
  });
});

test('the payload wins over the live chart on where the data comes from', () => {
  const formData = proposedChartFormData(live, {
    params: JSON.stringify({ viz_type: 'table', datasource: '1__table' }),
    viz_type: 'table',
    datasource_id: 9,
    datasource_type: 'table',
  });

  expect(formData).toMatchObject({ viz_type: 'table', datasource: '9__table' });
});

test.each([
  ['not json at all', 'not json'],
  ['a list rather than a body', '[1, 2]'],
])('params that are %s fall back to the live chart', (_label, params) => {
  // A body that will not parse is a body approval would fail on too, and
  // saying so belongs to the panel. Here it means the payload's other
  // fields are still worth drawing rather than showing nothing.
  expect(proposedChartFormData(live, { params, viz_type: 'table' })).toMatchObject(
    { viz_type: 'table', datasource: '1__table' },
  );
});

test('nothing is drawn when neither the payload nor the chart names a type', () => {
  expect(
    proposedChartFormData(undefined, {
      params: JSON.stringify({ row_limit: 10 }),
    }),
  ).toBeNull();
});
