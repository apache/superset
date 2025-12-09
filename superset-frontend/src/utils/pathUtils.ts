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
import { applicationRoot } from 'src/utils/getBootstrapData';

/**
 * Takes a string path to a resource and prefixes it with the application root that is
 * defined in the application configuration. The application path is sanitized.
 * @param path A string path to a resource
 */
export function ensureAppRoot(path: string): string {
  return `${applicationRoot()}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Creates a URL with the proper application root prefix for subdirectory deployments.
 * Use this when constructing URLs for navigation, API calls, or file downloads.
 *
 * @param path - The path to convert to a full URL (e.g., '/sqllab', '/api/v1/chart/123')
 * @returns The path prefixed with the application root (e.g., '/superset/sqllab')
 *
 * @example
 * // In a subdirectory deployment at /superset
 * makeUrl('/sqllab?new=true') // returns '/superset/sqllab?new=true'
 * makeUrl('/api/v1/chart/export/123/') // returns '/superset/api/v1/chart/export/123/'
 */
export function makeUrl(path: string): string {
  return ensureAppRoot(path);
}
