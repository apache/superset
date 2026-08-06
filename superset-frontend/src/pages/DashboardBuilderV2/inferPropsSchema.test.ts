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
import inferPropsSchema, { untypedKeys } from './inferPropsSchema';

test('each property is typed by the value the block is holding', () => {
  const schema = inferPropsSchema({
    title: 'Revenue',
    limit: 10,
    showLegend: true,
  });

  expect(schema).toEqual({
    type: 'object',
    properties: {
      title: { type: 'string' },
      limit: { type: 'number' },
      showLegend: { type: 'boolean' },
    },
  });
});

test('a nested object is described all the way down', () => {
  // `dataBinding` is the shape most worth reaching in a form rather than in
  // a string of JSON, and it is two levels deep before it says anything.
  const schema = inferPropsSchema({
    dataBinding: { datasetId: 3, filters: { region: 'EMEA' } },
  });

  expect(schema.properties?.dataBinding).toEqual({
    type: 'object',
    properties: {
      datasetId: { type: 'number' },
      filters: {
        type: 'object',
        properties: { region: { type: 'string' } },
      },
    },
  });
});

test('a list is described by what is in it', () => {
  const schema = inferPropsSchema({
    metrics: ['count', 'sum__value'],
    columnDefs: [{ field: 'name', width: 120 }],
  });

  expect(schema.properties?.metrics).toEqual({
    type: 'array',
    items: { type: 'string' },
  });
  expect(schema.properties?.columnDefs).toEqual({
    type: 'array',
    items: {
      type: 'object',
      properties: { field: { type: 'string' }, width: { type: 'number' } },
    },
  });
});

test('an empty list is still a list, of nothing in particular', () => {
  // There is no element to read a type off, and guessing one would make the
  // first thing added to it the wrong type.
  const schema = inferPropsSchema({ metrics: [] });

  expect(schema.properties?.metrics).toEqual({ type: 'array', items: {} });
});

test('a property holding nothing is left out rather than given a type it has not got', () => {
  // `null` says only that the key exists. Typing it as a string would turn
  // the first edit into a silent change of type, and typing it as an object
  // would render a group with no fields — so the form declines it and says
  // where it can still be edited.
  const schema = inferPropsSchema({ kept: 'yes', cleared: null });

  expect(Object.keys(schema.properties ?? {})).toEqual(['kept']);
  expect(untypedKeys({ kept: 'yes', cleared: null })).toEqual(['cleared']);
});

test('a block with no properties has an empty schema rather than no schema', () => {
  // JsonForms is handed this either way; an absent `properties` throws where
  // an empty one renders nothing.
  expect(inferPropsSchema(undefined)).toEqual({
    type: 'object',
    properties: {},
  });
});
