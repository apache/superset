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
import { RegistryWithDefaultKey, OverwritePolicy } from '../models';
import createD3NumberFormatter from './factories/createD3NumberFormatter';
import createSmartNumberFormatter from './factories/createSmartNumberFormatter';
import NumberFormats from './NumberFormats';


export default class NumberFormatterRegistry extends RegistryWithDefaultKey


{
  constructor() {
    super({
      name: 'NumberFormatter',
      overwritePolicy: OverwritePolicy.WARN });


    this.registerValue(
    NumberFormats.SMART_NUMBER,
    createSmartNumberFormatter());

    this.registerValue(
    NumberFormats.SMART_NUMBER_SIGNED,
    createSmartNumberFormatter({ signed: true }));

    this.setDefaultKey(NumberFormats.SMART_NUMBER);
  }

  get(formatterId) {
    const targetFormat = `${
    formatterId === null ||
    typeof formatterId === 'undefined' ||
    formatterId === '' ?
    this.defaultKey :
    formatterId
    }`.trim();

    if (this.has(targetFormat)) {
      return super.get(targetFormat);
    }

    // Create new formatter if does not exist
    const formatter = createD3NumberFormatter({
      formatString: targetFormat });

    this.registerValue(targetFormat, formatter);

    return formatter;
  }

  format(
  formatterId,
  value)
  {
    return this.get(formatterId)(value);
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(NumberFormatterRegistry, "NumberFormatterRegistry", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormatterRegistry.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();