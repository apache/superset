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
  '/////ygEAAAQAAAAAAAKAA4ABgAFAAgACgAAAAABBAAQAAAAAAAKAAwAAAAEAAgACgAAAPwCAAAEAAAAAQAAAAwAAAAIAAwABAAIAAgAAADUAgAABAAAAMUCAAB7ImluZGV4X2NvbHVtbnMiOiBbXSwgImNvbHVtbl9pbmRleGVzIjogW10sICJjb2x1bW5zIjogW3sibmFtZSI6ICJyZWdpb24iLCAiZmllbGRfbmFtZSI6ICJyZWdpb24iLCAicGFuZGFzX3R5cGUiOiAidW5pY29kZSIsICJudW1weV90eXBlIjogIm9iamVjdCIsICJtZXRhZGF0YSI6IG51bGx9LCB7Im5hbWUiOiAic2FsZXMiLCAiZmllbGRfbmFtZSI6ICJzYWxlcyIsICJwYW5kYXNfdHlwZSI6ICJmbG9hdDY0IiwgIm51bXB5X3R5cGUiOiAiZmxvYXQ2NCIsICJtZXRhZGF0YSI6IG51bGx9LCB7Im5hbWUiOiAicmF0aW8iLCAiZmllbGRfbmFtZSI6ICJyYXRpbyIsICJwYW5kYXNfdHlwZSI6ICJmbG9hdDY0IiwgIm51bXB5X3R5cGUiOiAiZmxvYXQ2NCIsICJtZXRhZGF0YSI6IG51bGx9LCB7Im5hbWUiOiAidHMiLCAiZmllbGRfbmFtZSI6ICJ0cyIsICJwYW5kYXNfdHlwZSI6ICJkYXRldGltZSIsICJudW1weV90eXBlIjogImRhdGV0aW1lNjRbbnNdIiwgIm1ldGFkYXRhIjogbnVsbH0sIHsibmFtZSI6ICJmbGFnIiwgImZpZWxkX25hbWUiOiAiZmxhZyIsICJwYW5kYXNfdHlwZSI6ICJib29sIiwgIm51bXB5X3R5cGUiOiAib2JqZWN0IiwgIm1ldGFkYXRhIjogbnVsbH1dLCAiYXR0cmlidXRlcyI6IHt9LCAiY3JlYXRvciI6IHsibGlicmFyeSI6ICJweWFycm93IiwgInZlcnNpb24iOiAiMjUuMC4xIn0sICJwYW5kYXNfdmVyc2lvbiI6ICIyLjMuMyJ9AAAABgAAAHBhbmRhcwAABQAAANAAAACMAAAAXAAAADAAAAAEAAAAVP///wAAAQYQAAAAGAAAAAQAAAAAAAAABAAAAGZsYWcAAAAARP///3z///8AAAEKEAAAABQAAAAEAAAAAAAAAAIAAAB0cwAAqv///wAAAwCk////AAABAxAAAAAYAAAABAAAAAAAAAAFAAAAcmF0aW8AAADW////AAACAND///8AAAEDEAAAABwAAAAEAAAAAAAAAAUAAABzYWxlcwAGAAgABgAGAAAAAAACABAAFAAIAAYABwAMAAAAEAAQAAAAAAABBRAAAAAcAAAABAAAAAAAAAAGAAAAcmVnaW9uAAAEAAQABAAAAP////9YAQAAFAAAAAAAAAAMABYABgAFAAgADAAMAAAAAAMEABgAAACQAAAAAAAAAAAACgAYAAwABAAIAAoAAADMAAAAEAAAAAMAAAAAAAAAAAAAAAsAAAAAAAAAAAAAAAEAAAAAAAAACAAAAAAAAAAQAAAAAAAAABgAAAAAAAAACAAAAAAAAAAgAAAAAAAAAAEAAAAAAAAAKAAAAAAAAAAYAAAAAAAAAEAAAAAAAAAAAQAAAAAAAABIAAAAAAAAABgAAAAAAAAAYAAAAAAAAAABAAAAAAAAAGgAAAAAAAAAGAAAAAAAAACAAAAAAAAAAAEAAAAAAAAAiAAAAAAAAAABAAAAAAAAAAAAAAAFAAAAAwAAAAAAAAABAAAAAAAAAAMAAAAAAAAAAQAAAAAAAAADAAAAAAAAAAEAAAAAAAAAAwAAAAAAAAABAAAAAAAAAAMAAAAAAAAAAQAAAAAAAAADAAAAAAAAAAAAAAAEAAAACAAAAAgAAABFTUVBQVBBQwMAAAAAAAAAAAAAAAAAJEAAAAAAAAA0QAAAAAAAAPh/BQAAAAAAAAAAAAAAAAD4PwAAAAAAAPh/AAAAAAAACkADAAAAAAAAAAAAZQEXEKYXANCim1ot2RcAAAAAAAAAgAMAAAAAAAAAAQAAAAAAAAD/////AAAAAA==';

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

// DataFrame: name (str), SUM(num)__outliers (object column of Python sets, as
// the boxplot post-processing operator produces), passed through
// ``ChartDataRestApi._arrow_with_query_metadata`` with a label_map, colnames,
// coltypes, is_cached, cache_key, query and rowcount sidecar.
const LIST_COLUMN_WITH_QUERY_METADATA_IPC =
  '/////5ADAAAQAAAAAAAKAA4ABgAFAAgACgAAAAABBAAQAAAAAAAKAAwAAAAEAAgACgAAALQCAAAEAAAAAgAAAPQAAAAEAAAAHP///8wAAAAEAAAAvgAAAHsibGFiZWxfbWFwIjogeyJTVU0obnVtKV9fb3V0bGllcnMiOiBbIlNVTShudW0pIl19LCAiY29sbmFtZXMiOiBbIm5hbWUiLCAiU1VNKG51bSlfX291dGxpZXJzIl0sICJjb2x0eXBlcyI6IFsxLCAwXSwgImlzX2NhY2hlZCI6IHRydWUsICJjYWNoZV9rZXkiOiAiYWJjIiwgInF1ZXJ5IjogIlNFTEVDVCAxIiwgInJvd2NvdW50IjogMn0AAA4AAABzdXBlcnNldC5xdWVyeQAACAAMAAQACAAIAAAApAEAAAQAAACXAQAAeyJpbmRleF9jb2x1bW5zIjogW10sICJjb2x1bW5faW5kZXhlcyI6IFtdLCAiY29sdW1ucyI6IFt7Im5hbWUiOiAibmFtZSIsICJmaWVsZF9uYW1lIjogIm5hbWUiLCAicGFuZGFzX3R5cGUiOiAidW5pY29kZSIsICJudW1weV90eXBlIjogIm9iamVjdCIsICJtZXRhZGF0YSI6IG51bGx9LCB7Im5hbWUiOiAiU1VNKG51bSlfX291dGxpZXJzIiwgImZpZWxkX25hbWUiOiAiU1VNKG51bSlfX291dGxpZXJzIiwgInBhbmRhc190eXBlIjogImxpc3RbZmxvYXQ2NF0iLCAibnVtcHlfdHlwZSI6ICJvYmplY3QiLCAibWV0YWRhdGEiOiBudWxsfV0sICJhdHRyaWJ1dGVzIjoge30sICJjcmVhdG9yIjogeyJsaWJyYXJ5IjogInB5YXJyb3ciLCAidmVyc2lvbiI6ICIyNS4wLjEifSwgInBhbmRhc192ZXJzaW9uIjogIjIuMy4zIn0ABgAAAHBhbmRhcwAAAgAAAIAAAAAEAAAAmP///wAAAQwUAAAAKAAAAAQAAAABAAAAIAAAABIAAABTVU0obnVtKV9fb3V0bGllcnMAAJj////Q////AAABAxAAAAAcAAAABAAAAAAAAAAEAAAAaXRlbQAABgAIAAYABgAAAAAAAgAQABQACAAGAAcADAAAABAAEAAAAAAAAQUQAAAAHAAAAAQAAAAAAAAABAAAAG5hbWUAAAAABAAEAAQAAAD/////+AAAABQAAAAAAAAADAAWAAYABQAIAAwADAAAAAADBAAYAAAAOAAAAAAAAAAAAAoAGAAMAAQACAAKAAAAjAAAABAAAAACAAAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAQAAAAAAAAAAcAAAAAAAAAGAAAAAAAAAAAAAAAAAAAABgAAAAAAAAADAAAAAAAAAAoAAAAAAAAAAAAAAAAAAAAKAAAAAAAAAAQAAAAAAAAAAAAAAADAAAAAgAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAHAAAAAAAAAGJveWdpcmwAAAAAAAIAAAACAAAAAAAAAAAAAAAAAPg/AAAAAAAABED/////AAAAAA==';

test('converts List columns to plain arrays, as the JSON wire format does', () => {
  const result = arrowBufferToQueryData(
    base64ToArrayBuffer(LIST_COLUMN_WITH_QUERY_METADATA_IPC),
  );

  expect(result.data).toEqual([
    { name: 'boy', 'SUM(num)__outliers': [1.5, 2.5] },
    { name: 'girl', 'SUM(num)__outliers': [] },
  ]);
  expect(Array.isArray(result.data[0]['SUM(num)__outliers'])).toBe(true);
});

// DataFrame: ints (list of Python ints, incl. one outside the JS-safe range
// and a null member), tags (list of str, incl. an empty list), point (dicts,
// which pyarrow encodes as a Struct column, incl. null members).
const NESTED_LIST_AND_STRUCT_IPC =
  '/////7ADAAAQAAAAAAAKAA4ABgAFAAgACgAAAAABBAAQAAAAAAAKAAwAAAAEAAgACgAAACQCAAAEAAAAAQAAAAwAAAAIAAwABAAIAAgAAAD8AQAABAAAAOwBAAB7ImluZGV4X2NvbHVtbnMiOiBbXSwgImNvbHVtbl9pbmRleGVzIjogW10sICJjb2x1bW5zIjogW3sibmFtZSI6ICJpbnRzIiwgImZpZWxkX25hbWUiOiAiaW50cyIsICJwYW5kYXNfdHlwZSI6ICJsaXN0W2ludDY0XSIsICJudW1weV90eXBlIjogIm9iamVjdCIsICJtZXRhZGF0YSI6IG51bGx9LCB7Im5hbWUiOiAidGFncyIsICJmaWVsZF9uYW1lIjogInRhZ3MiLCAicGFuZGFzX3R5cGUiOiAibGlzdFt1bmljb2RlXSIsICJudW1weV90eXBlIjogIm9iamVjdCIsICJtZXRhZGF0YSI6IG51bGx9LCB7Im5hbWUiOiAicG9pbnQiLCAiZmllbGRfbmFtZSI6ICJwb2ludCIsICJwYW5kYXNfdHlwZSI6ICJvYmplY3QiLCAibnVtcHlfdHlwZSI6ICJvYmplY3QiLCAibWV0YWRhdGEiOiBudWxsfV0sICJhdHRyaWJ1dGVzIjoge30sICJjcmVhdG9yIjogeyJsaWJyYXJ5IjogInB5YXJyb3ciLCAidmVyc2lvbiI6ICIyNS4wLjEifSwgInBhbmRhc192ZXJzaW9uIjogIjIuMy4zIn0AAAAABgAAAHBhbmRhcwAAAwAAAOQAAACMAAAABAAAAPj+//8AAAENGAAAACAAAAAEAAAAAgAAAEAAAAAUAAAABQAAAHBvaW50AAAALP///yj///8AAAEFEAAAABgAAAAEAAAAAAAAAAUAAABsYWJlbAAAAFT///9Q////AAABAxAAAAAYAAAABAAAAAAAAAABAAAAeAAGAAgABgAGAAAAAAACAHz///8AAAEMFAAAABwAAAAEAAAAAQAAABQAAAAEAAAAdGFncwAAAACs////qP///wAAAQUQAAAAGAAAAAQAAAAAAAAABAAAAGl0ZW0AAAAA1P///9D///8AAAEMFAAAACAAAAAEAAAAAQAAACgAAAAEAAAAaW50cwAAAAAEAAQABAAAABAAFAAIAAYABwAMAAAAEAAQAAAAAAABAhAAAAAgAAAABAAAAAAAAAAEAAAAaXRlbQAAAAAIAAwACAAHAAgAAAAAAAABQAAAAP////+4AQAAFAAAAAAAAAAMABYABgAFAAgADAAMAAAAAAMEABgAAACQAAAAAAAAAAAACgAYAAwABAAIAAoAAAAMAQAAEAAAAAIAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAABAAAAAAAAAAAQAAAAAAAAAYAAAAAAAAABgAAAAAAAAAMAAAAAAAAAAAAAAAAAAAADAAAAAAAAAADAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAMAAAAAAAAAFAAAAAAAAAAAgAAAAAAAABYAAAAAAAAAAAAAAAAAAAAWAAAAAAAAAABAAAAAAAAAGAAAAAAAAAAEAAAAAAAAABwAAAAAAAAAAEAAAAAAAAAeAAAAAAAAAAMAAAAAAAAAIgAAAAAAAAAAQAAAAAAAAAAAAAABwAAAAIAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAEAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAABAAAAAAAAAAIAAAAAAAAAAQAAAAAAAAAAAAAAAgAAAAMAAAAAAAAAAwAAAAAAAAABAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAgAAAAIAAAAAAAAAAAAAAAEAAAACAAAAAAAAAGFiAAAAAAAAAQAAAAAAAAAAAAAAAAD4PwAAAAAAAAAAAQAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAcAAAAAAAAAD/////AAAAAA==';

test('converts nested List and Struct members with the same scalar rules as columns', () => {
  const result = arrowBufferToQueryData(
    base64ToArrayBuffer(NESTED_LIST_AND_STRUCT_IPC),
  );

  expect(result.data).toEqual([
    {
      ints: [1, '1152921504606846976'],
      tags: ['a', 'b'],
      point: { x: 1.5, label: 'p' },
    },
    { ints: [null], tags: [], point: { x: null, label: null } },
  ]);
});

// DataFrame: day (object column of datetime.date, which pyarrow encodes as
// Date32), w/ null.
const DATE32_IPC =
  '/////7ABAAAQAAAAAAAKAA4ABgAFAAgACgAAAAABBAAQAAAAAAAKAAwAAAAEAAgACgAAADwBAAAEAAAAAQAAAAwAAAAIAAwABAAIAAgAAAAUAQAABAAAAAQBAAB7ImluZGV4X2NvbHVtbnMiOiBbXSwgImNvbHVtbl9pbmRleGVzIjogW10sICJjb2x1bW5zIjogW3sibmFtZSI6ICJkYXkiLCAiZmllbGRfbmFtZSI6ICJkYXkiLCAicGFuZGFzX3R5cGUiOiAiZGF0ZSIsICJudW1weV90eXBlIjogIm9iamVjdCIsICJtZXRhZGF0YSI6IG51bGx9XSwgImF0dHJpYnV0ZXMiOiB7fSwgImNyZWF0b3IiOiB7ImxpYnJhcnkiOiAicHlhcnJvdyIsICJ2ZXJzaW9uIjogIjI1LjAuMSJ9LCAicGFuZGFzX3ZlcnNpb24iOiAiMi4zLjMifQAAAAAGAAAAcGFuZGFzAAABAAAAFAAAABAAFAAIAAYABwAMAAAAEAAQAAAAAAABCBAAAAAcAAAABAAAAAAAAAADAAAAZGF5AAAABgAIAAYABgAAAAAAAAD/////iAAAABQAAAAAAAAADAAWAAYABQAIAAwADAAAAAADBAAYAAAAEAAAAAAAAAAAAAoAGAAMAAQACAAKAAAAPAAAABAAAAACAAAAAAAAAAAAAAACAAAAAAAAAAAAAAABAAAAAAAAAAgAAAAAAAAACAAAAAAAAAAAAAAAAQAAAAIAAAAAAAAAAQAAAAAAAAABAAAAAAAAAFdHAAAAAAAA/////wAAAAA=';

test('decodes Date32 columns to epoch milliseconds typed as temporal', () => {
  const result = arrowBufferToQueryData(base64ToArrayBuffer(DATE32_IPC));

  expect(result.coltypes).toEqual([GenericDataType.Temporal]);
  // 2020-01-02T00:00:00Z
  expect(result.data).toEqual([{ day: 1577923200000 }, { day: null }]);
});

test('merges the query metadata carried in the Arrow schema over the defaults', () => {
  const result = arrowBufferToQueryData(
    base64ToArrayBuffer(LIST_COLUMN_WITH_QUERY_METADATA_IPC),
  );

  expect(result).toMatchObject({
    label_map: { 'SUM(num)__outliers': ['SUM(num)'] },
    colnames: ['name', 'SUM(num)__outliers'],
    coltypes: [GenericDataType.String, GenericDataType.Numeric],
    is_cached: true,
    cache_key: 'abc',
    query: 'SELECT 1',
    rowcount: 2,
    status: 'success',
    error: null,
  });
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
