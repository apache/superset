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

/**
 * @fileoverview Laying a held write over the chart as it is now.
 *
 * These assertions came across with the composition itself, from the hook
 * that used to hold both halves of this. The other half -- whether a given
 * set of changed fields is worth offering a switch for -- did not: that is a
 * question about why the write is held, so it belongs to whoever is holding
 * it and is asserted on their side.
 */
import type { QueryFormData } from '@superset-ui/core';
import { composeHeldChart, composeHeldChartForItsHolder } from './heldChart';

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

test('the held controls are what the chart is drawn from', () => {
  const formData = composeHeldChart(
    live,
    captured({ viz_type: 'deck_grid', datasource: '1__table', row_limit: 50 }),
  );

  expect(formData).toMatchObject({
    viz_type: 'deck_grid',
    datasource: '1__table',
    row_limit: 50,
  });
});

test('a held version is queried as an unsaved chart', () => {
  // Otherwise the held version and what viewers are served share a cache key
  // on the live chart, and whichever ran last wins.
  const formData = composeHeldChart(
    live,
    captured({ viz_type: 'deck_grid', slice_id: 1 }),
  );

  expect(formData?.slice_id).toBe(0);
});

test('the holder edits their own chart, not an unsaved copy of it', () => {
  // The other half of the pair. A reader is looking at a version they do not
  // own and must not touch the live chart's cache slot; the holder is editing
  // that chart and their next save has to land on it (sc-131032).
  const formData = composeHeldChartForItsHolder(
    live,
    captured({ viz_type: 'deck_grid', slice_id: 1, row_limit: 50 }),
  );

  expect(formData?.slice_id).toBe(1);
  expect(formData?.row_limit).toBe(50);
});

test('the holder keeps their chart id even when the body omits it', () => {
  // A REST PUT that changes only the viz type carries no params, so the id
  // has to come off the live chart. Falling through to `undefined` here would
  // hand Explore a chart with no identity and turn the holder's next Save
  // into a Save as.
  const formData = composeHeldChartForItsHolder(live, { viz_type: 'table' });

  expect(formData?.slice_id).toBe(1);
  expect(formData?.viz_type).toBe('table');
});

test('a chart-type change that carries no params still composes', () => {
  // A REST PUT sends only what moved. Keying this on `params` meant such a
  // change to the drawing could not be drawn at all.
  const formData = composeHeldChart(live, { viz_type: 'table' });

  expect(formData).toMatchObject({
    viz_type: 'table',
    datasource: '1__table',
    row_limit: 1000,
    slice_id: 0,
  });
});

test('a body narrower than the legacy save falls back to the live chart', () => {
  // A save through the REST API can send params alone.
  const formData = composeHeldChart(live, {
    params: JSON.stringify({ row_limit: 10 }),
  });

  expect(formData).toMatchObject({
    viz_type: 'deck_grid',
    datasource: '1__table',
    row_limit: 10,
  });
});

test('the body wins over the live chart on where the data comes from', () => {
  const formData = composeHeldChart(live, {
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
  // A body that will not parse is a body applying would fail on too, and
  // saying so belongs to whoever is holding it. Here it means the body's
  // other fields are still worth drawing rather than showing nothing.
  expect(composeHeldChart(live, { params, viz_type: 'table' })).toMatchObject({
    viz_type: 'table',
    datasource: '1__table',
  });
});

test('nothing is drawn when neither the body nor the chart names a type', () => {
  expect(
    composeHeldChart(undefined, {
      params: JSON.stringify({ row_limit: 10 }),
    }),
  ).toBeNull();
});
