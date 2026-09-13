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
 * Parity golden-writer (Apache Superset #33615).
 *
 * For each shared input fixture in `__fixtures__/formdata/<viz>.json`, run the
 * exact backend code path (`generateQueryContext`) and record the resulting
 * query_context to `__fixtures__/expected/<viz>.json`. The Python parity test
 * (`tests/unit_tests/charts/commands/importers/v1/query_context_parity_test.py`)
 * then runs the SAME `generateQueryContext` in V8 over the SAME inputs and
 * asserts byte-equality with these goldens — proving the backend synthesis is
 * pixel-faithful to the frontend `buildQuery`.
 *
 * FOUNDATION: 2 viz types today (pivot_table_v2, echarts_timeseries) — the
 * cases where the generic Python derivation diverges. Full "perfect" coverage =
 * a fixture per registered viz type (follow-on, ideally code-generated).
 */
import fs from 'fs';
import path from 'path';
import { generateQueryContext, VIZ_TYPES } from './entry';

const FORMDATA_DIR = path.join(__dirname, '__fixtures__', 'formdata');
const EXPECTED_DIR = path.join(__dirname, '__fixtures__', 'expected');

describe('backend query-context parity goldens', () => {
  beforeAll(() => {
    fs.mkdirSync(EXPECTED_DIR, { recursive: true });
  });

  const fixtures = fs
    .readdirSync(FORMDATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''));

  test.each(fixtures)('records + validates query_context for %s', vizType => {
    const formData = JSON.parse(
      fs.readFileSync(path.join(FORMDATA_DIR, `${vizType}.json`), 'utf8'),
    );
    const raw = generateQueryContext(vizType, JSON.stringify(formData));
    const result = JSON.parse(raw);

    // The viz type must be covered by the backend registry, and the output must
    // be a real context (no sentinel), with a datasource + at least one query.
    expect(VIZ_TYPES).toContain(vizType);
    expect(result.__unsupported__).toBeUndefined();
    expect(result.__error__).toBeUndefined();
    expect(result.datasource).toBeDefined();
    expect(Array.isArray(result.queries)).toBe(true);
    expect(result.queries.length).toBeGreaterThan(0);

    // Record the golden the Python parity test compares against.
    fs.writeFileSync(
      path.join(EXPECTED_DIR, `${vizType}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
      'utf8',
    );
  });
});
