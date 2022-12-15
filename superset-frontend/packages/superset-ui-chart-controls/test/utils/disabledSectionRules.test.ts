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

import { GenericDataType } from '@superset-ui/core';
import { isXAxisTemporal } from '../../src';

const nonTemporal = {
  datasource: {
    columns: [
      {
        column_name: 'test',
        type_generic: GenericDataType.NUMERIC,
      },
    ],
  },
  form_data: {
    x_axis: 'test',
  },
};

const temporal = {
  datasource: {
    columns: [
      {
        column_name: 'test',
        type_generic: GenericDataType.TEMPORAL,
      },
    ],
  },
  form_data: {
    x_axis: 'test',
  },
};

test('X axis is temporal', () => {
  expect(
    isXAxisTemporal(temporal),
  ).toEqual(true);
});

test('X axis is not temporal', () => {
  expect(
    isXAxisTemporal(nonTemporal),
  ).toEqual(false);
});

test('X axis is not available', () => {
  expect(
    isXAxisTemporal({
      ...nonTemporal,
      form_data: {},
    }),
  ).toEqual(false);
});
