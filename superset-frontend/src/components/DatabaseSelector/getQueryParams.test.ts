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

import { getQueryParams } from './getQueryParams';

test('Does not return filters in the query - no args', () => {
  const params = getQueryParams();
  expect(params).toBe(
    '(filters:!((col:expose_in_sqllab,opr:eq,value:!t)),order_columns:database_name,order_direction:asc,page:0,page_size:-1)',
  );
});

test('Does not return filters in the query - explicit false', () => {
  const params = getQueryParams({ disableFilters: false });
  expect(params).toBe(
    '(filters:!((col:expose_in_sqllab,opr:eq,value:!t)),order_columns:database_name,order_direction:asc,page:0,page_size:-1)',
  );
});

test('Does not return filters in the query', () => {
  const params = getQueryParams({ disableFilters: true });
  expect(params).toBe(
    '(order_columns:database_name,order_direction:asc,page:0,page_size:-1)',
  );
});
