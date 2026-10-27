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
import {
  Table,
  tableFromIPC,
  Type,
  Vector,
  util as arrowUtil,
} from 'apache-arrow';
import { GenericDataType } from '@apache-superset/core/common';
import {
  ChartDataResponseResult,
  DataRecord,
  DataRecordValue,
} from './types/QueryResponse';

/**
 * Mirrors ``superset/utils/core.py::JS_MAX_INTEGER`` (2**53 - 1). An Arrow
 * Int64 column decodes to a JS BigInt; integers outside this range travel as
 * strings on the JSON wire format too (see
 * ``superset/dataframe.py::_convert_big_integers``), so the Arrow path
 * matches that here rather than silently truncating precision through
 * ``Number()``.
 */
const JS_MAX_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Arrow schema-metadata key holding a chart-data query's non-data fields as
 * JSON. Mirrors ``superset/charts/data/api.py::ARROW_QUERY_METADATA_KEY``.
 */
export const ARROW_QUERY_METADATA_KEY = 'superset.query';

function convertBigInt(value: bigint): DataRecordValue {
  if (value > JS_MAX_INTEGER || value < -JS_MAX_INTEGER) {
    return value.toString();
  }
  return Number(value);
}

/**
 * Decode an Arrow Decimal value (apache-arrow represents it as a
 * DecimalBigNum wrapping the unscaled integer's raw limbs, not a JS
 * primitive) into the same JS number the JSON wire format already produces
 * for a Python ``Decimal`` (``float(value)`` — see
 * ``superset/utils/json.py::base_json_conv``).
 *
 * This loses precision the same way the JSON path already does: both go
 * through a JS ``number``. Superset's JSON wire format has never carried
 * exact arbitrary-precision decimals to the browser, so Arrow isn't
 * regressing anything here.
 */
function convertDecimal(value: unknown, scale: number): DataRecordValue {
  const unscaled = arrowUtil.bigNumToString(
    value as Parameters<typeof arrowUtil.bigNumToString>[0],
  );
  return Number(unscaled) / 10 ** scale;
}

/**
 * Non-finite floats (Infinity/-Infinity) round-trip through Arrow as real
 * IEEE-754 values — ``_to_arrow_ipc`` (superset/common/query_context_processor.py)
 * does no sanitization, unlike the JSON path's ``df_to_records``, which maps
 * every non-finite float to ``null`` (superset/dataframe.py). Match the JSON
 * behavior here so a flagged chart doesn't start seeing real ``Infinity``
 * values a JSON-format chart never would for the same query. NaN already
 * arrives as Arrow ``null`` (pyarrow treats float NaN as missing on
 * ``Table.from_pandas``), so only +/-Infinity needs this guard.
 */
function convertNumber(value: number): DataRecordValue {
  return Number.isFinite(value) ? value : null;
}

/**
 * Convert a nested (List/Struct/Map) Arrow value to the plain JS array or
 * object the JSON wire format would have produced. apache-arrow hands these
 * back as `Vector`/row proxies rather than arrays, so code like the box plot's
 * `datum['metric__outliers']` (a Python set, serialized as a list) would
 * otherwise receive an object without the array methods it relies on.
 */
function convertNested(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'bigint') {
    return convertBigInt(value);
  }
  if (typeof value === 'number') {
    return convertNumber(value);
  }
  if (value instanceof Vector) {
    return Array.from(value as Iterable<unknown>, convertNested);
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    const json = (value as { toJSON?: () => unknown }).toJSON?.() ?? value;
    if (json instanceof Map) {
      return Object.fromEntries(
        Array.from(json, ([key, item]) => [key, convertNested(item)]),
      );
    }
    return Object.fromEntries(
      Object.entries(json as Record<string, unknown>).map(([key, item]) => [
        key,
        convertNested(item),
      ]),
    );
  }
  return value;
}

/**
 * Convert one Arrow column value to the DataRecordValue the JSON wire format
 * would have produced for the same underlying data.
 *
 * Verified empirically against real ``_to_arrow_ipc`` output compared with
 * ``df_to_records`` + the JSON response's ``json_int_dttm_ser`` for strings,
 * floats, nulls/NaN, booleans, Date32/Timestamp (incl. tz-aware) columns,
 * Int64 (both in- and out-of-JS-safe-range), and Decimal128. Timestamps and
 * dates already decode to plain epoch-millisecond numbers via apache-arrow's
 * row proxy — identical to ``json_int_dttm_ser`` — so no conversion is
 * needed for them here.
 */
function convertValue(
  value: unknown,
  isDecimal: boolean,
  scale: number,
): DataRecordValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (isDecimal) {
    return convertDecimal(value, scale);
  }
  if (typeof value === 'bigint') {
    return convertBigInt(value);
  }
  if (typeof value === 'number') {
    return convertNumber(value);
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    // Nested values have no DataRecordValue member; consumers that read them
    // cast the record value, exactly as they do for the JSON wire format.
    return convertNested(value) as DataRecordValue;
  }
  // string, boolean: already the right shape.
  return value as DataRecordValue;
}

function toGenericDataType(typeId: Type): GenericDataType {
  switch (typeId) {
    case Type.Int:
    case Type.Float:
    case Type.Decimal:
      return GenericDataType.Numeric;
    case Type.Bool:
      return GenericDataType.Boolean;
    case Type.Date:
    case Type.Timestamp:
    case Type.Time:
      return GenericDataType.Temporal;
    case Type.List:
    case Type.FixedSizeList:
    case Type.LargeList:
      return GenericDataType.MultiValue;
    default:
      return GenericDataType.String;
  }
}

export function arrowTableToDataRecords(table: Table): DataRecord[] {
  const { fields } = table.schema;
  const { numRows } = table;
  const columnMeta = fields.map(field => ({
    name: field.name,
    isDecimal: field.type.typeId === Type.Decimal,
    // Only Decimal types carry a `scale`; TS doesn't narrow `field.type` to
    // that subtype here, so read it defensively.
    scale: (field.type as { scale?: number }).scale ?? 0,
  }));

  return Array.from({ length: numRows }, (_unused, rowIndex) => {
    const row = table.get(rowIndex);
    const record: DataRecord = {};
    columnMeta.forEach(({ name, isDecimal, scale }) => {
      record[name] = convertValue(row?.[name], isDecimal, scale);
    });
    return record;
  });
}

/**
 * Parse an Arrow IPC stream (as returned by the Arrow branches of
 * ``/api/v1/chart/data`` and ``/api/v1/datasource/<type>/<id>/query``) into
 * the same ``ChartDataResponseResult`` shape a JSON response's `queries[n]`
 * entry has, so this is a transparent substitution at the network layer and
 * every consumer downstream (transformProps, etc.) keeps working unchanged.
 *
 * The query's non-data fields (`label_map`, `annotation_data`, cache and
 * filter metadata, the SQL `query` text, ...) travel as JSON under the
 * `ARROW_QUERY_METADATA_KEY` schema-metadata key (see
 * ``ChartDataRestApi._arrow_with_query_metadata``) and are merged over the
 * result. A stream without that key (e.g. from the datasource query
 * endpoint) gets inert defaults instead, so chrome that reads those fields
 * degrades quietly rather than throwing.
 */
export function arrowBufferToQueryData(
  buffer: ArrayBuffer,
): ChartDataResponseResult {
  const table = tableFromIPC(buffer);
  const data = arrowTableToDataRecords(table);
  const colnames = table.schema.fields.map(field => field.name);
  const coltypes = table.schema.fields.map(field =>
    toGenericDataType(field.type.typeId),
  );
  const rawMetadata = table.schema.metadata.get(ARROW_QUERY_METADATA_KEY);
  const queryMetadata: Partial<ChartDataResponseResult> = rawMetadata
    ? JSON.parse(rawMetadata)
    : {};

  return {
    annotation_data: null,
    cache_key: null,
    cache_timeout: null,
    cached_dttm: null,
    queried_dttm: null,
    colnames,
    coltypes,
    error: null,
    is_cached: false,
    query: '',
    rowcount: table.numRows,
    sql_rowcount: table.numRows,
    stacktrace: null,
    status: 'success',
    from_dttm: null,
    to_dttm: null,
    ...queryMetadata,
    data,
  };
}
