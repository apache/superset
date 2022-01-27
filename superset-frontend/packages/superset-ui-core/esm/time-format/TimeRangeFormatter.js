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
import { ExtensibleFunction } from '../models';








class TimeRangeFormatter extends ExtensibleFunction {










  constructor(config)





  {
    super((value) => this.format(value));this.id = void 0;this.label = void 0;this.description = void 0;this.formatFunc = void 0;this.useLocalTime = void 0;

    const {
      id,
      label,
      description = '',
      formatFunc,
      useLocalTime = false } =
    config;

    this.id = id;
    this.label = label != null ? label : id;
    this.description = description;
    this.formatFunc = formatFunc;
    this.useLocalTime = useLocalTime;
  }

  format(values) {
    return this.formatFunc(values);
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}const _default =
TimeRangeFormatter;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(TimeRangeFormatter, "TimeRangeFormatter", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/time-format/TimeRangeFormatter.ts");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/time-format/TimeRangeFormatter.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();