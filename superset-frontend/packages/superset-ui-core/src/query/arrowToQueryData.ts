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
import { Table, tableFromIPC, Type, util as arrowUtil } from 'apache-arrow';
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
 * KNOWN GAP: the Arrow IPC bytes carry only the DataFrame itself — none of
 * the sidecar query metadata (cache_key, is_cached, cached_dttm, the SQL
 * `query` text, `status`, `stacktrace`, `timing`, `annotation_data`,
 * `warning`, applied/rejected filters) travels over this wire format today.
 * Those fields are filled with inert defaults below rather than left
 * `undefined`, so chrome that reads them (cache badges, "View query", the
 * timing panel) degrades quietly instead of throwing. Carrying that metadata
 * over Arrow too is a follow-up, not part of this draft.
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

  return {
    annotation_data: null,
    cache_key: null,
    cache_timeout: null,
    cached_dttm: null,
    queried_dttm: null,
    data,
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
  };
}
