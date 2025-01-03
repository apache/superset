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
import { ThemeProvider, supersetTheme, JsonObject } from '@superset-ui/core';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

type TestWithIdType<T> = T extends string ? string : { 'data-test': string };

export const renderWithTheme = (component: JSX.Element) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

// using bem standard
export const testWithId =
  <T extends string | JsonObject = JsonObject>(
    prefix?: string,
    idOnly = false,
  ) =>
  (id?: string, localIdOnly = false): TestWithIdType<T> => {
    const resultIdOnly = localIdOnly || idOnly;
    if (!id && prefix) {
      return (
        resultIdOnly ? prefix : { 'data-test': prefix }
      ) as TestWithIdType<T>;
    }
    if (id && !prefix) {
      return (resultIdOnly ? id : { 'data-test': id }) as TestWithIdType<T>;
    }
    if (!id && !prefix) {
      // eslint-disable-next-line no-console
      console.warn('testWithId function has missed "prefix" and "id" params');
      return (resultIdOnly ? '' : { 'data-test': '' }) as TestWithIdType<T>;
    }
    const newId = `${prefix}__${id}`;
    return (resultIdOnly ? newId : { 'data-test': newId }) as TestWithIdType<T>;
  };
