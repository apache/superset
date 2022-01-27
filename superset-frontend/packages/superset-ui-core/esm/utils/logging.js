(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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

const console = window.console || {};
const log = console.log || (() => {});

const logger = {
  log,
  debug: console.debug || log,
  info: console.info || log,
  warn: console.warn || log,
  error: console.error || log,
  trace: console.trace || log,
  table: console.table || log };


/**
 * Superset frontend logger, currently just an alias to console.
 * This may be extended to support numerous console operations safely
 * i.e.: https://developer.mozilla.org/en-US/docs/Web/API/Console
 */const _default =
logger;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(console, "console", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/utils/logging.ts");reactHotLoader.register(log, "log", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/utils/logging.ts");reactHotLoader.register(logger, "logger", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/utils/logging.ts");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/utils/logging.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();