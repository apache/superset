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

import { getColumnKeywords } from './getColumnKeywords';

test('returns HTML for a column tooltip', () => {
  const expected = {
    column_name: 'test column1',
    verbose_name: null,
    is_certified: false,
    certified_by: null,
    description: 'test description',
    type: 'VARCHAR',
  };
  expect(getColumnKeywords([expected])).toContainEqual({
    name: expected.column_name,
    value: expected.column_name,
    docHTML: expect.stringContaining(expected.description),
    score: 50,
    meta: 'column',
  });
});
