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

import { ASSET_BASE_URL } from 'src/constants';

/**
 * Takes a string path to a static assetand prefixes it with any ASSET_BASE_URL that is
 * defined in the webpack configuration.
 * @param path A string path to a resource
 */
export function assetUrl(path: string) {
  return `${ASSET_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
