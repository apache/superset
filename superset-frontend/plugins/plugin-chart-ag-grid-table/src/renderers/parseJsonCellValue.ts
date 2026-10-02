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

export type JsonContainer = Record<string, unknown> | unknown[];

// Skip multi-megabyte cells so a single value cannot stall the grid while
// it is being parsed on the render path.
const MAX_JSON_CELL_LENGTH = 5_000_000;

function isJsonContainer(value: unknown): value is JsonContainer {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (value instanceof Date) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Accept a JSON object or array, either already parsed or as text.
 * Scalars, invalid JSON, and non-JSON text return null so the cell stays
 * on the plain-text renderer.
 */
export function parseJsonCellValue(value: unknown): JsonContainer | null {
  if (isJsonContainer(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_JSON_CELL_LENGTH ||
    (trimmed[0] !== '{' && trimmed[0] !== '[')
  ) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isJsonContainer(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** One-line preview. Whitespace inside the original text is collapsed. */
export function jsonCellPreview(
  value: JsonContainer,
  rawText?: string,
): string {
  const source = rawText ?? JSON.stringify(value);
  return source.replace(/\s+/g, ' ').trim();
}
