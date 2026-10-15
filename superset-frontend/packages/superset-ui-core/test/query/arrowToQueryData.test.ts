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
import { GenericDataType } from '@apache-superset/core/common';
import { arrowBufferToQueryData } from '@superset-ui/core';

/**
 * Each fixture below is real Arrow IPC-stream output from Superset's own
 * ``QueryContextProcessor._to_arrow_ipc`` (superset/common/query_context_processor.py),
 * captured against a small pandas DataFrame — not hand-rolled Arrow bytes.
 * The ``expected`` records next to each fixture are what
 * ``superset/dataframe.py::df_to_records`` plus the JSON response's
 * ``json.dumps(..., default=json_int_dttm_ser, ignore_nan=True)`` produce
 * for that *same* DataFrame — i.e. exactly what a JSON-format chart request
 * would hand to the same plugin's transformProps. This test's job is to
 * prove arrowBufferToQueryData reproduces those same JS values from the
 * Arrow bytes, so a plugin can't tell the two wire formats apart.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Built byte-by-byte with this test environment's own Uint8Array/
  // ArrayBuffer constructors (jsdom), rather than returning Node Buffer's
  // pooled backing ArrayBuffer — apache-arrow's IPC reader silently reads
  // zero fields from a cross-realm ArrayBuffer under jsdom.
  const binary = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// DataFrame: region (str, w/ null), sales (int64, w/ null -> float64),
// ratio (float64, incl. NaN), ts (naive datetime64[ns], w/ NaT),
// flag (bool, w/ null).
const MIXED_TYPES_AND_NULLS_IPC =
  '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';

// DataFrame: big_int (int64, outside +/- JS_MAX_SAFE_INTEGER on rows 1 and 3),
// small_int (int64, within range), ts_tz (tz-aware datetime64[ns, UTC]).
const BIGINT_AND_TZ_TIMESTAMP_IPC =
  '/////zgDAAAQAAAAAAAKAA4ABgAFAAgACgAAAAABBAAQAAAAAAAKAAwAAAAEAAgACgAAADwCAAAEAAAAAQAAAAwAAAAIAAwABAAIAAgAAAAUAgAABAAAAAcCAAB7ImluZGV4X2NvbHVtbnMiOiBbXSwgImNvbHVtbl9pbmRleGVzIjogW10sICJjb2x1bW5zIjogW3sibmFtZSI6ICJiaWdfaW50IiwgImZpZWxkX25hbWUiOiAiYmlnX2ludCIsICJwYW5kYXNfdHlwZSI6ICJpbnQ2NCIsICJudW1weV90eXBlIjogImludDY0IiwgIm1ldGFkYXRhIjogbnVsbH0sIHsibmFtZSI6ICJzbWFsbF9pbnQiLCAiZmllbGRfbmFtZSI6ICJzbWFsbF9pbnQiLCAicGFuZGFzX3R5cGUiOiAiaW50NjQiLCAibnVtcHlfdHlwZSI6ICJpbnQ2NCIsICJtZXRhZGF0YSI6IG51bGx9LCB7Im5hbWUiOiAidHNfdHoiLCAiZmllbGRfbmFtZSI6ICJ0c190eiIsICJwYW5kYXNfdHlwZSI6ICJkYXRldGltZXR6IiwgIm51bXB5X3R5cGUiOiAiZGF0ZXRpbWU2NFtuc10iLCAibWV0YWRhdGEiOiB7InRpbWV6b25lIjogIlVUQyJ9fV0sICJhdHRyaWJ1dGVzIjoge30sICJjcmVhdG9yIjogeyJsaWJyYXJ5IjogInB5YXJyb3ciLCAidmVyc2lvbiI6ICIyNS4wLjEifSwgInBhbmRhc192ZXJzaW9uIjogIjIuMy4zIn0ABgAAAHBhbmRhcwAAAwAAAJAAAABIAAAABAAAAIz///8AAAEKEAAAACAAAAAEAAAAAAAAAAUAAAB0c190egAAAAgADAAGAAgACAAAAAAAAwAEAAAAAwAAAFVUQwDM////AAABAhAAAAAcAAAABAAAAAAAAAAJAAAAc21hbGxfaW50AAAAwP///wAAAAFAAAAAEAAUAAgABgAHAAwAAAAQABAAAAAAAAECEAAAACAAAAAEAAAAAAAAAAcAAABiaWdfaW50AAgADAAIAAcACAAAAAAAAAFAAAAAAAAAAP/////oAAAAFAAAAAAAAAAMABYABgAFAAgADAAMAAAAAAMEABgAAABIAAAAAAAAAAAACgAYAAwABAAIAAoAAAB8AAAAEAAAAAMAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAABgAAAAAAAAAAAAAAAAAAAAYAAAAAAAAABgAAAAAAAAAMAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAGAAAAAAAAAAAAAAAAwAAAAMAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAE7zMKZLm7YBKgAAAAAAAACISwe2oCVL8gEAAAAAAAAAAgAAAAAAAAADAAAAAAAAAAAAZQEXEKYXANCim1ot2RcANryEfmgWGP////8AAAAA';

// DataFrame: amount (object column of Decimal, precision=4 scale=2), w/ null.
const DECIMAL_IPC =
  '/////9ABAAAQAAAAAAAKAA4ABgAFAAgACgAAAAABBAAQAAAAAAAKAAwAAAAEAAgACgAAAFQBAAAEAAAAAQAAAAQAAACA/v//NAEAAAQAAAAlAQAAeyJpbmRleF9jb2x1bW5zIjogW10sICJjb2x1bW5faW5kZXhlcyI6IFtdLCAiY29sdW1ucyI6IFt7Im5hbWUiOiAiYW1vdW50IiwgImZpZWxkX25hbWUiOiAiYW1vdW50IiwgInBhbmRhc190eXBlIjogImRlY2ltYWwiLCAibnVtcHlfdHlwZSI6ICJvYmplY3QiLCAibWV0YWRhdGEiOiB7InByZWNpc2lvbiI6IDQsICJzY2FsZSI6IDJ9fV0sICJhdHRyaWJ1dGVzIjoge30sICJjcmVhdG9yIjogeyJsaWJyYXJ5IjogInB5YXJyb3ciLCAidmVyc2lvbiI6ICIyNS4wLjEifSwgInBhbmRhc192ZXJzaW9uIjogIjIuMy4zIn0AAAAGAAAAcGFuZGFzAAABAAAAFAAAABAAFAAIAAYABwAMAAAAEAAQAAAAAAABBxAAAAAgAAAABAAAAAAAAAAGAAAAYW1vdW50AAAIAAwABAAIAAgAAAAEAAAAAgAAAP////+IAAAAFAAAAAAAAAAMABYABgAFAAgADAAMAAAAAAMEABgAAAA4AAAAAAAAAAAACgAYAAwABAAIAAoAAAA8AAAAEAAAAAMAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAEAAAAAAAAACAAAAAAAAAAwAAAAAAAAAAAAAAABAAAAAwAAAAAAAAABAAAAAAAAAAMAAAAAAAAAGgQAAAAAAAAAAAAAAAAAAOkHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////wAAAAA=';

// DataFrame: val (float64) = [Infinity, -Infinity, 5.0].
const INFINITY_IPC =
  '/////7gBAAAQAAAAAAAKAA4ABgAFAAgACgAAAAABBAAQAAAAAAAKAAwAAAAEAAgACgAAAEABAAAEAAAAAQAAAAwAAAAIAAwABAAIAAgAAAAYAQAABAAAAAgBAAB7ImluZGV4X2NvbHVtbnMiOiBbXSwgImNvbHVtbl9pbmRleGVzIjogW10sICJjb2x1bW5zIjogW3sibmFtZSI6ICJ2YWwiLCAiZmllbGRfbmFtZSI6ICJ2YWwiLCAicGFuZGFzX3R5cGUiOiAiZmxvYXQ2NCIsICJudW1weV90eXBlIjogImZsb2F0NjQiLCAibWV0YWRhdGEiOiBudWxsfV0sICJhdHRyaWJ1dGVzIjoge30sICJjcmVhdG9yIjogeyJsaWJyYXJ5IjogInB5YXJyb3ciLCAidmVyc2lvbiI6ICIyNS4wLjEifSwgInBhbmRhc192ZXJzaW9uIjogIjIuMy4zIn0AAAAABgAAAHBhbmRhcwAAAQAAABQAAAAQABQACAAGAAcADAAAABAAEAAAAAAAAQMQAAAAHAAAAAQAAAAAAAAAAwAAAHZhbAAAAAYACAAGAAYAAAAAAAIAAAAAAP////+IAAAAFAAAAAAAAAAMABYABgAFAAgADAAMAAAAAAMEABgAAAAYAAAAAAAAAAAACgAYAAwABAAIAAoAAAA8AAAAEAAAAAMAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAABAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAPB/AAAAAAAA8P8AAAAAAAAUQP////8AAAAA';

test('converts strings, nulls, NaN, naive timestamps, and booleans to the JSON wire format values', () => {
  const result = arrowBufferToQueryData(
    base64ToArrayBuffer(MIXED_TYPES_AND_NULLS_IPC),
  );

  expect(result.colnames).toEqual(['region', 'sales', 'ratio', 'ts', 'flag']);
  expect(result.coltypes).toEqual([
    GenericDataType.String,
    GenericDataType.Numeric,
    GenericDataType.Numeric,
    GenericDataType.Temporal,
    GenericDataType.Boolean,
  ]);
  expect(result.rowcount).toBe(3);
  expect(result.data).toEqual([
    {
      region: 'EMEA',
      sales: 10,
      ratio: 1.5,
      ts: 1704067200000,
      flag: true,
    },
    // pandas' NaN-for-missing-int upcasts the whole `sales` column to
    // float64; the NaN `ratio` value is pyarrow-nulled on the way in.
    { region: 'APAC', sales: 20, ratio: null, ts: 1718454600000, flag: false },
    { region: null, sales: null, ratio: 3.25, ts: null, flag: null },
  ]);
});

test('converts Int64 to a number within JS safe-integer range, and to a string outside it', () => {
  const result = arrowBufferToQueryData(
    base64ToArrayBuffer(BIGINT_AND_TZ_TIMESTAMP_IPC),
  );

  expect(result.data).toEqual([
    {
      big_int: '123456789012345678', // outside Number.MAX_SAFE_INTEGER
      small_int: 1,
      ts_tz: 1704067200000,
    },
    { big_int: 42, small_int: 2, ts_tz: 1718454600000 },
    {
      big_int: '-987654321098765432', // outside -Number.MAX_SAFE_INTEGER
      small_int: 3,
      ts_tz: 1735689599000,
    },
  ]);
});

test('decodes Decimal128 the same way the JSON path converts a Python Decimal (float())', () => {
  const result = arrowBufferToQueryData(base64ToArrayBuffer(DECIMAL_IPC));

  expect(result.coltypes).toEqual([GenericDataType.Numeric]);
  expect(result.data).toEqual([
    { amount: 10.5 },
    { amount: 20.25 },
    { amount: null },
  ]);
});

test('nulls out +/-Infinity to match df_to_records, even though pyarrow does not', () => {
  // This is the one real divergence found between the two wire formats:
  // _to_arrow_ipc has no non-finite sanitization (unlike df_to_records), so
  // the raw Arrow bytes here really do contain IEEE-754 Infinity/-Infinity.
  // arrowBufferToQueryData corrects for it so a flagged chart can't observe
  // real Infinity values a JSON-format chart never would for the same data.
  const result = arrowBufferToQueryData(base64ToArrayBuffer(INFINITY_IPC));

  expect(result.data).toEqual([{ val: null }, { val: null }, { val: 5 }]);
});

test('fills in inert defaults for sidecar metadata the Arrow transport does not carry', () => {
  const result = arrowBufferToQueryData(
    base64ToArrayBuffer(MIXED_TYPES_AND_NULLS_IPC),
  );

  expect(result.cache_key).toBeNull();
  expect(result.is_cached).toBe(false);
  expect(result.error).toBeNull();
  expect(result.status).toBe('success');
});
