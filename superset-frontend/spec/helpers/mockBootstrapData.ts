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

/**
 * Shared `jest.mock('src/utils/getBootstrapData')` factory for list view
 * tests that rely on `isUserEditorOrAdmin`'s subject-based check
 * (`common.user_subjects`) to treat a mock user as a subject editor.
 *
 * Usage:
 *   jest.mock('src/utils/getBootstrapData', () =>
 *     mockUserSubjectsBootstrapData([1]),
 *   );
 *
 * NOTE: the `mock` name prefix is required so babel-plugin-jest-hoist allows
 * referencing this imported function from inside a `jest.mock()` factory.
 */
export const mockUserSubjectsBootstrapData = (userSubjects: number[]) => {
  const actual = jest.requireActual('src/utils/getBootstrapData');
  const { DEFAULT_BOOTSTRAP_DATA } = jest.requireActual('src/constants');
  return {
    __esModule: true,
    ...actual,
    default: jest.fn(() => ({
      ...DEFAULT_BOOTSTRAP_DATA,
      common: {
        ...DEFAULT_BOOTSTRAP_DATA.common,
        user_subjects: userSubjects,
      },
    })),
  };
};
