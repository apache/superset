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
import { CSSProperties } from 'react';

export interface CalendarRangePickerProps {
  /**
   * The active time range string in Superset canonical format.
   * Examples:
   * - Date range: "2026-11-01 : 2026-11-30"
   * - ISO datetime range: "2026-11-01T00:00:00 : 2026-11-30T23:59:59"
   * - Single date: "2026-11-01"
   * - Unset / No filter: "No filter", "", null, or undefined
   */
  value?: string | null;

  /**
   * Callback fired when date selection changes or when cleared.
   * Emits the formatted canonical string "YYYY-MM-DD : YYYY-MM-DD",
   * or the configured clearValue (defaults to "") when cleared.
   */
  onChange?: (value: string) => void;

  /**
   * Disables picker inputs.
   * Accepts a single boolean or a tuple [startDisabled, endDisabled].
   * Defaults to false.
   */
  disabled?: boolean | [boolean, boolean];

  /**
   * Input placeholder text for start and end dates.
   * Defaults to [t('Start date'), t('End date')].
   */
  placeholder?: [string, string];

  /**
   * Display and serialization date format.
   * Defaults to 'YYYY-MM-DD'.
   */
  format?: string;

  /**
   * Value emitted through onChange when user clears the selection.
   * Defaults to '' (empty string).
   */
  clearValue?: string;

  /**
   * Controls whether the clear ('x') icon is shown when a range is selected.
   * Defaults to true.
   */
  allowClear?: boolean;

  /**
   * Whether to treat the end date as inclusive.
   * Defaults to true.
   */
  inclusiveEndDate?: boolean;

  /**
   * Optional custom CSS class name applied to the picker root.
   */
  className?: string;

  /**
   * Optional inline styles.
   */
  style?: CSSProperties;

  /**
   * Test identifier for automated testing.
   * Defaults to 'calendar-range-picker'.
   */
  'data-test'?: string;

  /**
   * Whether the start date input should auto-focus on mount.
   * Defaults to false.
   */
  autoFocus?: boolean;

  /**
   * Preset picker size matching Ant Design button / input sizes.
   */
  size?: 'small' | 'middle' | 'large';

  /**
   * Validation status display ('error' | 'warning').
   */
  status?: 'error' | 'warning';

  /**
   * Optional custom callback to disable specific dates in the calendar grid.
   */
  disabledDate?: (currentDate: any) => boolean;

  /**
   * HTML element id.
   */
  id?: string;
}
