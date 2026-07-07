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
import { render, screen } from 'spec/helpers/testing-library';
import ModalHeader from './ModalHeader';
import type { DatabaseForm, DatabaseObject } from '../types';

// Force the production fallback branches (no SupersetText override) so the
// generated /user-docs documentation links are exercised.
jest.mock('src/views/CRUD/hooks', () => ({
  getDatabaseDocumentationLinks: () => undefined,
}));

const buildProps = (engine: string) => ({
  isLoading: false,
  isEditMode: false,
  useSqlAlchemyForm: false,
  hasConnectedDb: false,
  db: { engine } as Partial<DatabaseObject>,
  dbName: 'my db',
  dbModel: { name: engine, engine } as DatabaseForm,
});

const getDocHref = (engine: string) => {
  render(<ModalHeader {...buildProps(engine)} />, { useRedux: true });
  return screen.getByRole('link').getAttribute('href');
};

test('uses the generic /user-docs link when the engine name matches the doc slug', () => {
  expect(getDocHref('postgresql')).toBe(
    'https://superset.apache.org/user-docs/databases/supported/postgresql',
  );
});

test('maps divergent engine names to their /user-docs doc slugs', () => {
  expect(getDocHref('bigquery')).toBe(
    'https://superset.apache.org/user-docs/databases/supported/google-bigquery',
  );
});

test('does not link to the legacy /docs/databases namespace', () => {
  expect(getDocHref('mysql')).not.toContain('/docs/databases/');
});
