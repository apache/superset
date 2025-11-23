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
import { JsonValue } from '@superset-ui/core';
import { ControlComponentProps } from '@superset-ui/chart-controls';

/**
 * Extended ControlComponentProps that properly types the onChange callback
 * to support validation errors as a second parameter.
 *
 * The actual Control component implementation (src/explore/components/Control.tsx)
 * accepts onChange with signature (value: any, errors: any[]) => void,
 * but the base ControlComponentProps interface only defines (value: JsonValue) => void.
 *
 * This interface extends the base props and overrides onChange to match the
 * actual implementation, providing proper type safety.
 */
export interface ExtendedControlComponentProps<
  ValueType extends JsonValue = JsonValue,
> extends Omit<ControlComponentProps<ValueType>, 'onChange'> {
  /**
   * Callback invoked when the control value changes.
   * @param value - The new value for the control
   * @param errors - Array of validation error messages (empty array if no errors)
   */
  onChange?: (value: ValueType, errors?: string[]) => void;
}
