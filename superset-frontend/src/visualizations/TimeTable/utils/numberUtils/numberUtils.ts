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
 * Safely parses a value to a numeric type
 * @param value - The value to parse (string, number, or null)
 * @returns The numeric value or 0 if invalid
 */
export function parseToNumber(value?: string | number | null): number {
  const displayValue = value ?? 0;
  const numericValue =
    typeof displayValue === 'string' ? parseFloat(displayValue) : displayValue;

  return Number.isNaN(numericValue) ? 0 : numericValue;
}
