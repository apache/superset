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

import withLabel from './withLabel';

test('withLabel returns false when validator passes', () => {
  const validator = () => false as false;
  const labeled = withLabel(validator, 'Field');
  expect(labeled('any value')).toBe(false);
});

test('withLabel prepends label to validator error message', () => {
  const validator = () => 'is required';
  const labeled = withLabel(validator, 'Name');
  expect(labeled('')).toBe('Name is required');
});

test('withLabel passes value and state to underlying validator', () => {
  const validator = jest.fn(() => false as false);
  const labeled = withLabel(validator, 'Field');
  labeled('value', { someState: true });
  expect(validator).toHaveBeenCalledWith('value', { someState: true });
});
