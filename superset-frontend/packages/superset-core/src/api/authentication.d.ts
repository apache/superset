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
 * Namespace for authentication-related utilities and functions.
 * Provides methods to handle authentication mechanisms such as CSRF tokens.
 */
export declare namespace authentication {
  /**
   * Retrieves the CSRF token used for securing requests against cross-site request forgery attacks.
   *
   * @returns The CSRF token as a string, or undefined if not available.
   */
  export function getCSRFToken(): Promise<string | undefined>;
}
