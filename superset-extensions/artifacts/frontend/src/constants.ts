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
 * @fileoverview The extension's identity, mirroring the backend's
 * `superset_oss.artifacts.constants`.
 */

/**
 * PLACEHOLDER: decide the publisher before the first release; every id below
 * derives from it, and changing it orphans placed artifact widgets.
 */
export const PUBLISHER = 'superset-oss';
export const NAME = 'artifacts';

/** The full widget id: the host prefixes backend ids, never frontend ones. */
export const WIDGET_TYPE = `extensions.${PUBLISHER}.${NAME}.artifact`;

/** Where the host mounts the extension's REST APIs. */
export const API_BASE_PATH = `/extensions/${PUBLISHER}/${NAME}`;

export const DRAFT_TOKEN_HEADER = 'X-Canvas-Draft';
