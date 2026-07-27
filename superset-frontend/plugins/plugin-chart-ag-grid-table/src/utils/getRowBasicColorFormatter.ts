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
import { BASIC_COLOR_FORMATTERS_ROW_KEY } from '../consts';
import { BasicColorFormatterType } from '../types';

export type RowFormatters = { [key: string]: BasicColorFormatterType };

/**
 * Resolves the basic (increase/decrease) color formatters for a given AG Grid
 * row node.
 *
 * The formatter is attached to the row data object itself (see transformProps),
 * so it follows the row through client-side sorting. Looking it up positionally
 * by the displayed `rowIndex` was wrong once the user sorted the table, because
 * the displayed index no longer matched the original data order (#105973).
 *
 * Falls back to the positional array for safety when no attached formatter is
 * present.
 */
export default function getRowBasicColorFormatter(
  node: { data?: Record<string | symbol, unknown> } | undefined,
  rowIndex: number | null | undefined,
  basicColorFormatters: RowFormatters[] | undefined,
): RowFormatters | undefined {
  const attached = node?.data?.[BASIC_COLOR_FORMATTERS_ROW_KEY] as
    RowFormatters | undefined;
  if (attached) {
    return attached;
  }
  if (rowIndex == null) {
    return undefined;
  }
  return basicColorFormatters?.[rowIndex];
}
