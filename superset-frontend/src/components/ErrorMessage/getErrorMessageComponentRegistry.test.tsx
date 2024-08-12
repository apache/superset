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
import getErrorMessageComponentRegistry from 'src/components/ErrorMessage/getErrorMessageComponentRegistry';
import { ErrorMessageComponentProps } from 'src/components/ErrorMessage/types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ERROR_MESSAGE_COMPONENT = (_: ErrorMessageComponentProps) => (
  <div>Test error</div>
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const OVERRIDE_ERROR_MESSAGE_COMPONENT = (_: ErrorMessageComponentProps) => (
  <div>Custom error</div>
);

test('should return undefined for a non existent key', () => {
  expect(getErrorMessageComponentRegistry().get('INVALID_KEY')).toEqual(
    undefined,
  );
});

test('should return a component for a set key', () => {
  getErrorMessageComponentRegistry().registerValue(
    'VALID_KEY',
    ERROR_MESSAGE_COMPONENT,
  );

  expect(getErrorMessageComponentRegistry().get('VALID_KEY')).toEqual(
    ERROR_MESSAGE_COMPONENT,
  );
});

test('should return the correct component for an overridden key', () => {
  getErrorMessageComponentRegistry().registerValue(
    'OVERRIDE_KEY',
    ERROR_MESSAGE_COMPONENT,
  );

  getErrorMessageComponentRegistry().registerValue(
    'OVERRIDE_KEY',
    OVERRIDE_ERROR_MESSAGE_COMPONENT,
  );

  expect(getErrorMessageComponentRegistry().get('OVERRIDE_KEY')).toEqual(
    OVERRIDE_ERROR_MESSAGE_COMPONENT,
  );
});
