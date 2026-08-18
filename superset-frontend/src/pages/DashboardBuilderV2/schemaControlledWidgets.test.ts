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
import { renderHook, waitFor } from '@testing-library/react';
import { SupersetClient } from '@superset-ui/core';
import {
  resetSchemaControlledWidgetTypesForTests,
  useSchemaControlledWidgetTypes,
} from './schemaControlledWidgets';

const getSpy = jest.spyOn(SupersetClient, 'get');

beforeEach(() => {
  resetSchemaControlledWidgetTypesForTests();
  getSpy.mockReset();
});

test('derives the schema-controlled types from the backend registry', async () => {
  getSpy.mockResolvedValue({
    json: { result: [{ id: 'balloons' }, { id: 'metric-tile' }] },
  } as never);

  const { result } = renderHook(() => useSchemaControlledWidgetTypes());

  // `null` while the first fetch is in flight, so the caller can show Loading.
  expect(result.current).toBeNull();

  await waitFor(() => expect(result.current).not.toBeNull());
  expect(result.current?.has('balloons')).toBe(true);
  expect(result.current?.has('metric-tile')).toBe(true);
  // A type the backend didn't report gets the generic form, not a schema panel.
  expect(result.current?.has('markdown')).toBe(false);
  expect(getSpy).toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: '/api/v1/widgets/types' }),
  );
});

test('fetches only once and caches the result across hook users', async () => {
  getSpy.mockResolvedValue({ json: { result: [{ id: 'balloons' }] } } as never);

  const first = renderHook(() => useSchemaControlledWidgetTypes());
  await waitFor(() => expect(first.result.current).not.toBeNull());
  renderHook(() => useSchemaControlledWidgetTypes());

  expect(getSpy).toHaveBeenCalledTimes(1);
});

test('fails open to an empty set when the request errors', async () => {
  getSpy.mockRejectedValue(new Error('boom'));

  const { result } = renderHook(() => useSchemaControlledWidgetTypes());

  await waitFor(() => expect(result.current).not.toBeNull());
  expect(result.current?.size).toBe(0);
});
