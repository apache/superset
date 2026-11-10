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

export type Callback = (...args: any[]) => void;

export interface ConfirmStatusChangeProps {
  /**
   * A function is called with the same arguments `onConfirm` will receive.
   * The title names an outcome too, so a dialog whose body is written from
   * the selection and whose title is not can disagree with itself — which
   * is the defect this pair of props exists to prevent.
   */
  title: ReactNode | ((...args: any[]) => ReactNode);
  /**
   * A function is called with the same arguments `onConfirm` will receive,
   * so a dialog can describe what was actually selected. The bulk delete
   * needs it: a selection can hold assets that end differently -- some
   * filed for review, some archived now -- and a fixed sentence is wrong
   * about half of them whichever one it picks.
   *
   * Called only while the dialog is open, so it always has the arguments
   * the trigger passed.
   */
  description: ReactNode | ((...args: any[]) => ReactNode);
  onConfirm: Callback;
  children: (showConfirm: Callback) => ReactNode;
  /**
   * Forwarded to the underlying DeleteModal: recoverable (soft-delete) mode
   * drops the "type DELETE to confirm" step and uses a primary confirm button.
   */
  recoverable?: boolean;
  /** Forwarded to the underlying DeleteModal: overrides the confirm label only. */
  primaryButtonName?: string;
  /** Forwarded to the underlying DeleteModal: overrides the confirm style only. */
  primaryButtonStyle?: ButtonStyle;
  /**
   * Forwarded to the underlying DeleteModal: keeps the confirm button disabled
   * regardless of the typed-text gate, e.g. while the caller is still loading
   * information the user needs before confirming.
   */
  disablePrimaryButton?: boolean;
}
