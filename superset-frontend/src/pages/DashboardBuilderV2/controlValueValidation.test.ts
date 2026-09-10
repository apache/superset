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
import { SupersetClient } from '@superset-ui/core';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import 'src/core/dashboard';
import { commitWidgetProps } from './controlValueValidation';

const provider = DashboardProvider.getInstance();
const postSpy = jest.spyOn(SupersetClient, 'post');

beforeEach(() => {
  provider.reset();
  postSpy.mockReset();
});

const mount = (props?: Record<string, unknown>) =>
  provider.addWidget(provider.getRoot().id, 0, {
    type: 'metric-tile',
    ...(props ? { props } : {}),
  });

test('commits the backend-normalized values, not the raw candidate, when the endpoint returns them', async () => {
  const id = mount({ datasetId: '1' });
  postSpy.mockResolvedValue({
    json: {
      result: {
        errors: [],
        // Pydantic-coerced: the string the raw candidate held becomes an int.
        values: { datasetId: 1, metrics: ['count'] },
      },
    },
  } as never);

  const result = await commitWidgetProps(id, 'metric-tile', {
    metrics: ['count'],
  });

  expect(result).toEqual({
    ok: true,
    values: { datasetId: 1, metrics: ['count'] },
  });
  expect(provider.getNode(id)?.props).toEqual({
    datasetId: 1,
    metrics: ['count'],
  });
});

test('falls back to the raw merged candidate when the endpoint sends no normalized values back', async () => {
  const id = mount({ datasetId: 1 });
  postSpy.mockResolvedValue({
    json: { result: { errors: [] } },
  } as never);

  const result = await commitWidgetProps(id, 'metric-tile', {
    metrics: ['count'],
  });

  expect(result).toEqual({
    ok: true,
    values: { datasetId: 1, metrics: ['count'] },
  });
  expect(provider.getNode(id)?.props).toEqual({
    datasetId: 1,
    metrics: ['count'],
  });
});

test('a rejected candidate is never committed, normalized or otherwise', async () => {
  const id = mount({ datasetId: 1, metrics: ['count'] });
  postSpy.mockResolvedValue({
    json: {
      result: {
        errors: [{ loc: ['metrics'], message: 'Required' }],
        values: null,
      },
    },
  } as never);

  const result = await commitWidgetProps(id, 'metric-tile', {
    metrics: [],
  });

  expect(result).toEqual({
    ok: false,
    errors: [{ loc: ['metrics'], message: 'Required' }],
  });
  expect(provider.getNode(id)?.props).toEqual({
    datasetId: 1,
    metrics: ['count'],
  });
});

test('onBeforeCommit vetoing a stale commit skips the write even once validation accepted it', async () => {
  const id = mount({ datasetId: 1 });
  postSpy.mockResolvedValue({
    json: {
      result: { errors: [], values: { datasetId: 1, metrics: ['count'] } },
    },
  } as never);

  const result = await commitWidgetProps(
    id,
    'metric-tile',
    { metrics: ['count'] },
    { onBeforeCommit: () => false },
  );

  expect(result).toEqual({ ok: false, errors: [] });
  expect(provider.getNode(id)?.props).toEqual({ datasetId: 1 });
});
