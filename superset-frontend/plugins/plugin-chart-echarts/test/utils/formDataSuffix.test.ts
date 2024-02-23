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
import {
  retainFormDataSuffix,
  removeFormDataSuffix,
} from '../../src/utils/formDataSuffix';

const formData = {
  datasource: 'dummy',
  viz_type: 'table',
  metrics: ['a', 'b'],
  columns: ['foo', 'bar'],
  limit: 100,
  metrics_b: ['c', 'd'],
  columns_b: ['hello', 'world'],
  limit_b: 200,
};

test('should keep controls with suffix', () => {
  expect(retainFormDataSuffix(formData, '_b')).toEqual({
    datasource: 'dummy',
    viz_type: 'table',
    metrics: ['c', 'd'],
    columns: ['hello', 'world'],
    limit: 200,
  });
  // no side effect
  expect(retainFormDataSuffix(formData, '_b')).not.toEqual(formData);
});

test('should remove controls with suffix', () => {
  expect(removeFormDataSuffix(formData, '_b')).toEqual({
    datasource: 'dummy',
    viz_type: 'table',
    metrics: ['a', 'b'],
    columns: ['foo', 'bar'],
    limit: 100,
  });
  // no side effect
  expect(removeFormDataSuffix(formData, '_b')).not.toEqual(formData);
});
