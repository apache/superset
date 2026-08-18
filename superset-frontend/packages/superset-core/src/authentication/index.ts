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
 * @fileoverview Authentication API for Superset extensions.
 *
 * This module provides functions for handling user authentication and security
 * within Superset extensions.
 */

/**
 * Retrieves the CSRF token used for securing requests against cross-site request forgery attacks.
 * This token should be included in the headers of POST, PUT, DELETE, and other state-changing
 * HTTP requests to ensure they are authorized.
 *
 * @returns A promise that resolves to the CSRF token as a string, or undefined if not available.
 *
 * @example
 * ```typescript
 * const csrfToken = await getCSRFToken();
 * if (csrfToken) {
 *   // Include in request headers
 *   headers['X-CSRFToken'] = csrfToken;
 * }
 * ```
 */
export declare function getCSRFToken(): Promise<string | undefined>;
