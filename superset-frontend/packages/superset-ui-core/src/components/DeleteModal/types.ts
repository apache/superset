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

import type { ReactNode } from 'react';
import type { ButtonStyle } from '../Button/types';

export interface DeleteModalProps {
  description: ReactNode;
  onConfirm: () => void;
  onHide: () => void;
  open: boolean;
  title: ReactNode;
  name?: string;
  /**
   * Recoverable (soft-delete) mode: the action moves the object to an archive
   * rather than destroying it, so the modal hides the "type DELETE to confirm"
   * step and defaults the confirm button to "Archive" with primary styling.
   * Explicit `primaryButtonName` / `primaryButtonStyle` override the
   * label/style only — never this gate.
   */
  recoverable?: boolean;
  /**
   * Label of the confirm button. Defaults to "Archive" when `recoverable`,
   * otherwise "Delete". An explicit value wins over the `recoverable`
   * default; it does not change the typed-confirmation gate, which is
   * governed by `recoverable` alone.
   */
  primaryButtonName?: string;
  /**
   * Style of the confirm button. Defaults to `'primary'` when `recoverable`,
   * otherwise `'danger'`. Same precedence as `primaryButtonName`.
   */
  primaryButtonStyle?: ButtonStyle;
  /** Disable confirmation independently of the typed-text gate. */
  disablePrimaryButton?: boolean;
  /** Show progress on the primary action and prevent duplicate submission. */
  loading?: boolean;
  /** Clear and re-arm the typed-text gate when the reviewed data changes. */
  confirmationResetKey?: string | number;
}
