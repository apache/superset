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
import { BASE_PATH } from 'src/constants';

const STARTS_WITH_BASE_PATH_RE = new RegExp(`^${BASE_PATH}`, '');

/**
 * Takes a string path to a resource and prefixes it with the BASE_PATH that is
 * defined in the webpack configuration.
 * @param path A string path to a resource
 */
export function ensureBasePath(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Strips the BASE_PATH from the given path if it exists
 */
export function stripBasePath(path: string): string {
  return path.replace(STARTS_WITH_BASE_PATH_RE, '');
}
