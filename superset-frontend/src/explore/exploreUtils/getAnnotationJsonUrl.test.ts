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
import { getAnnotationJsonUrl } from '.';

let windowLocation: any;

beforeAll(() => {
  windowLocation = window.location;
  // @ts-expect-error
  delete window.location;
});

beforeEach(() => {
  window.location = {
    search: '?testA=0&testB=1',
  } as any;
});

afterAll(() => {
  window.location = windowLocation;
});

test('get correct annotation when isNative:true', () => {
  const response = getAnnotationJsonUrl('slice_id', 'form_data', true);
  expect(response).toBe(
    '/superset/annotation_json/slice_id?form_data=%22form_data%22',
  );
});

test('get correct annotation when isNative:false', () => {
  const response = getAnnotationJsonUrl('slice_id', { json: 'my-data' }, false);
  expect(response).toBe(
    '/superset/slice_json/slice_id?form_data=%7B%22json%22%3A%22my-data%22%7D',
  );
});
