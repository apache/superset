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
import getOwnerName from './getOwnerName';

test('render owner name correctly', () => {
  expect(getOwnerName({ id: 1, first_name: 'Foo', last_name: 'Bar' })).toEqual(
    'Foo Bar',
  );

  expect(getOwnerName({ id: 2, full_name: 'John Doe' })).toEqual('John Doe');
});

test('return empty string for undefined owner', () => {
  expect(getOwnerName(undefined)).toEqual('');
});
