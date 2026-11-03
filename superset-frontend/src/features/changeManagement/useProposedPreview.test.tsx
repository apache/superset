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
import { act, renderHook } from '@testing-library/react';
import { createWrapper } from 'spec/helpers/testing-library';
import { useProposedPreview } from './useProposedPreview';
import { onProposedChart } from './events';
import type { ChangeRequest } from './types';

const baseRequest = {
  id: 1,
  asset_type: 'dashboard',
  asset_id: 5,
  status: 'pending',
  operation: 'update',
  command: null,
  proposed: { dashboard_title: 'New' },
} as unknown as ChangeRequest;

const setup = (overrides: Partial<ChangeRequest>) =>
  renderHook(() => useProposedPreview({ ...baseRequest, ...overrides }), {
    wrapper: createWrapper({ useRedux: true, useRouter: true }),
  });

test('can preview the main dashboard update', () => {
  expect(setup({}).result.current.canPreview).toBe(true);
});

test.each(['filters', 'colors', 'chart_customizations'])(
  'cannot overlay a %s change onto the dashboard',
  command => {
    expect(setup({ command }).result.current.canPreview).toBe(false);
  },
);

const chartRequest = {
  ...baseRequest,
  asset_type: 'chart',
  asset_id: 1,
  revision: 'r1',
  changed_fields: ['params', 'viz_type'],
  proposed: {
    slice_name: 'Deck.gl Grid',
    params: JSON.stringify({ viz_type: 'deck_grid', row_limit: 50 }),
    viz_type: 'deck_grid',
    datasource_id: 1,
    datasource_type: 'table',
  },
} as unknown as ChangeRequest;

test('can preview a chart whose change carries the controls', () => {
  // 129075: a chart reviewer used to get the live chart and a list of
  // setting names, with no way to see the chart they were approving.
  expect(setup(chartRequest).result.current.canPreview).toBe(true);
});

test('cannot preview a change that carries only a new name', () => {
  // A rename through the properties modal or the REST API sends
  // `slice_name` alone. A rename through Explore does not -- it posts every
  // control, so `params` moves too and the switch is offered. That boundary
  // is asserted in `proposedChart.test.ts`; this covers the narrow case.
  expect(
    setup({ ...chartRequest, changed_fields: ['slice_name'] }).result.current
      .canPreview,
  ).toBe(false);
});

test('the switch hands Explore the proposed chart, then takes it back', async () => {
  const seen: (unknown | null)[] = [];
  const stop = onProposedChart(formData => seen.push(formData));
  const { result } = setup(chartRequest);

  await act(async () => {
    await result.current.toggle(true);
  });
  expect(result.current.showing).toBe(true);
  expect(seen.at(-1)).toMatchObject({
    previewable: true,
    formData: { viz_type: 'deck_grid', row_limit: 50 },
  });

  await act(async () => {
    await result.current.toggle(false);
  });
  expect(result.current.showing).toBe(false);
  // Still previewable, but no form data: the reviewer lands back on exactly
  // what viewers are being served, and the live state stays labelled.
  expect(seen.at(-1)).toMatchObject({ previewable: true, formData: null });

  stop();
});

test('the live chart is announced without touching the switch', () => {
  // The silent default was the whole bug: a reviewer who never finds the
  // switch has to be told what they are looking at.
  const seen: unknown[] = [];
  const stop = onProposedChart(state => seen.push(state));

  setup(chartRequest);

  expect(seen.at(-1)).toMatchObject({ previewable: true, formData: null });
  stop();
});

test('a change that cannot be previewed tells Explore to say nothing', () => {
  const seen: unknown[] = [];
  const stop = onProposedChart(state => seen.push(state));

  setup({ ...chartRequest, changed_fields: ['slice_name'] });

  expect(seen.at(-1)).toMatchObject({ previewable: false, formData: null });
  stop();
});

test('the preview drops back to live when the change moves underneath', async () => {
  // `AssetReview` calls this hook before it decides whether to render
  // anything, so the banner and its switch disappear while the hook stays
  // mounted. Without this the reviewer keeps a proposal on screen with no
  // switch to turn it off -- which is what a refused decision does, since
  // the refusal path re-reads and finds the change gone.
  const seen: unknown[] = [];
  const stop = onProposedChart(state => seen.push(state));
  const { result, rerender } = renderHook(
    (request: ChangeRequest | null) => useProposedPreview(request),
    {
      wrapper: createWrapper({ useRedux: true, useRouter: true }),
      initialProps: chartRequest as ChangeRequest | null,
    },
  );

  await act(async () => {
    await result.current.toggle(true);
  });
  expect(result.current.showing).toBe(true);

  await act(async () => {
    rerender(null);
  });

  expect(result.current.showing).toBe(false);
  expect(seen.at(-1)).toMatchObject({ previewable: false, formData: null });
  stop();
});

test('an author re-saving drops the reviewer back to live', async () => {
  const { result, rerender } = renderHook(
    (request: ChangeRequest) => useProposedPreview(request),
    {
      wrapper: createWrapper({ useRedux: true, useRouter: true }),
      initialProps: chartRequest,
    },
  );

  await act(async () => {
    await result.current.toggle(true);
  });
  expect(result.current.showing).toBe(true);

  await act(async () => {
    rerender({ ...chartRequest, revision: 'r2' } as ChangeRequest);
  });

  // Rather than leaving a stale picture on screen for them to approve.
  expect(result.current.showing).toBe(false);
});

test('unmounting leaves Explore on the live chart', async () => {
  // The banner owns the switch and goes away the moment the change is
  // decided. Explore's preview state does not, so a reviewer would be left
  // on a proposal with no switch to turn off and no banner to explain it.
  const seen: (unknown | null)[] = [];
  const stop = onProposedChart(formData => seen.push(formData));
  const { result, unmount } = setup(chartRequest);

  await act(async () => {
    await result.current.toggle(true);
  });
  seen.length = 0;
  unmount();

  expect(seen.at(-1)).toMatchObject({ previewable: false, formData: null });

  stop();
});
