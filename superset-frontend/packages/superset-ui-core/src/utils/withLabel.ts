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

import type { ValidatorFunction } from '../validator';

/**
 * Wraps a validator function to prepend a label to its error message.
 *
 * @param validator - The validator function to wrap
 * @param label - The label to prepend to error messages
 * @returns A new validator function that includes the label in error messages
 *
 * @example
 * validators: [
 *   withLabel(validateInteger, t('Row limit')),
 * ]
 * // Returns: "Row limit is expected to be an integer"
 */
export default function withLabel<V = unknown, S = unknown>(
  validator: ValidatorFunction<V, S>,
  label: string,
): ValidatorFunction<V, S> {
  return (value: V, state?: S): string | false => {
    const error = validator(value, state);
    return error ? `${label} ${error}` : false;
  };
}
