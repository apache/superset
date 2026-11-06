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
 * @fileoverview Window namespace for Superset extensions.
 *
 * Global, host-level UI surfaces (e.g. toast notifications) that are not
 * scoped to any single view or panel an extension has registered.
 */

/**
 * Options for a toast shown via the `window` namespace.
 */
export interface MessageOptions {
  /**
   * How long the toast stays visible, in milliseconds. Falls back to the
   * host's per-severity default (see `MessageToasts/actions`) when omitted.
   */
  duration?: number;
}

/**
 * Show a transient informational toast to the current user.
 */
export declare function showInformationMessage(
  message: string,
  options?: MessageOptions,
): void;

/**
 * Show a transient warning toast to the current user.
 */
export declare function showWarningMessage(
  message: string,
  options?: MessageOptions,
): void;

/**
 * Show a transient error toast to the current user.
 */
export declare function showErrorMessage(
  message: string,
  options?: MessageOptions,
): void;
