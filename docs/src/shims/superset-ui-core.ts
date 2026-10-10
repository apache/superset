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
 * Lightweight shim for @superset-ui/core.
 *
 * Components in superset-ui-core/src/components/ self-reference the parent
 * package for utility imports. This shim re-exports only the specific
 * utilities they need, avoiding the full barrel file which pulls in heavy
 * dependencies (d3, query engine, color scales) that cause OOM during the
 * docs build.
 *
 * When adding exports here, verify the source file's imports don't cascade
 * into heavy modules (connection/SupersetClientClass, query/types, etc.).
 * Only add leaf-level utilities with minimal transitive dependencies.
 *
 * Exports that can't be shimmed safely (e.g. getClientErrorObject, which
 * pulls in connection/types → SupersetClientClass) will produce
 * ESModulesLinkingWarnings at build time — these are harmless.
 */

// Paths relative to docs/src/shims/ → superset-frontend/packages/superset-ui-core/src/

// utils — leaf modules with no heavy transitive deps
export { default as ensureIsArray } from '../../../superset-frontend/packages/superset-ui-core/src/utils/ensureIsArray';
export {
  safeHtmlSpan,
  isProbablyHTML,
  isJsonString,
} from '../../../superset-frontend/packages/superset-ui-core/src/utils/html';

// hooks
export { usePrevious } from '../../../superset-frontend/packages/superset-ui-core/src/hooks/usePrevious/usePrevious';
export { useTruncation } from '../../../superset-frontend/packages/superset-ui-core/src/hooks/useTruncation';

// time-format
export { getTimeFormatter } from '../../../superset-frontend/packages/superset-ui-core/src/time-format/TimeFormatterRegistrySingleton';
export { default as TimeFormats } from '../../../superset-frontend/packages/superset-ui-core/src/time-format/TimeFormats';

// color
export { hexToRgb } from '../../../superset-frontend/packages/superset-ui-core/src/color/utils';
