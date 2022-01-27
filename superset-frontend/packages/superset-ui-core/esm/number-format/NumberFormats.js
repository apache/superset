(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

const DOLLAR = '$,.2f';
const DOLLAR_SIGNED = '+$,.2f';
const DOLLAR_ROUND = '$,d';
const DOLLAR_ROUND_SIGNED = '+$,d';

const FLOAT_1_POINT = ',.1f';
const FLOAT_2_POINT = ',.2f';
const FLOAT_3_POINT = ',.3f';
const FLOAT = FLOAT_2_POINT;

const FLOAT_SIGNED_1_POINT = '+,.1f';
const FLOAT_SIGNED_2_POINT = '+,.2f';
const FLOAT_SIGNED_3_POINT = '+,.3f';
const FLOAT_SIGNED = FLOAT_SIGNED_2_POINT;

const INTEGER = ',d';
const INTEGER_SIGNED = '+,d';

const PERCENT_1_POINT = ',.1%';
const PERCENT_2_POINT = ',.2%';
const PERCENT_3_POINT = ',.3%';
const PERCENT = PERCENT_2_POINT;

const PERCENT_SIGNED_1_POINT = '+,.1%';
const PERCENT_SIGNED_2_POINT = '+,.2%';
const PERCENT_SIGNED_3_POINT = '+,.3%';
const PERCENT_SIGNED = PERCENT_SIGNED_2_POINT;

const SI_1_DIGIT = '.1s';
const SI_2_DIGIT = '.2s';
const SI_3_DIGIT = '.3s';
const SI = SI_3_DIGIT;

const SMART_NUMBER = 'SMART_NUMBER';
const SMART_NUMBER_SIGNED = 'SMART_NUMBER_SIGNED';

const NumberFormats = {
  DOLLAR,
  DOLLAR_ROUND,
  DOLLAR_ROUND_SIGNED,
  DOLLAR_SIGNED,
  FLOAT,
  FLOAT_1_POINT,
  FLOAT_2_POINT,
  FLOAT_3_POINT,
  FLOAT_SIGNED,
  FLOAT_SIGNED_1_POINT,
  FLOAT_SIGNED_2_POINT,
  FLOAT_SIGNED_3_POINT,
  INTEGER,
  INTEGER_SIGNED,
  PERCENT,
  PERCENT_1_POINT,
  PERCENT_2_POINT,
  PERCENT_3_POINT,
  PERCENT_SIGNED,
  PERCENT_SIGNED_1_POINT,
  PERCENT_SIGNED_2_POINT,
  PERCENT_SIGNED_3_POINT,
  SI,
  SI_1_DIGIT,
  SI_2_DIGIT,
  SI_3_DIGIT,
  SMART_NUMBER,
  SMART_NUMBER_SIGNED };const _default =


NumberFormats;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DOLLAR, "DOLLAR", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(DOLLAR_SIGNED, "DOLLAR_SIGNED", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(DOLLAR_ROUND, "DOLLAR_ROUND", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(DOLLAR_ROUND_SIGNED, "DOLLAR_ROUND_SIGNED", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(FLOAT_1_POINT, "FLOAT_1_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(FLOAT_2_POINT, "FLOAT_2_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(FLOAT_3_POINT, "FLOAT_3_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(FLOAT, "FLOAT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(FLOAT_SIGNED_1_POINT, "FLOAT_SIGNED_1_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(FLOAT_SIGNED_2_POINT, "FLOAT_SIGNED_2_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(FLOAT_SIGNED_3_POINT, "FLOAT_SIGNED_3_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(FLOAT_SIGNED, "FLOAT_SIGNED", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(INTEGER, "INTEGER", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(INTEGER_SIGNED, "INTEGER_SIGNED", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(PERCENT_1_POINT, "PERCENT_1_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(PERCENT_2_POINT, "PERCENT_2_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(PERCENT_3_POINT, "PERCENT_3_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(PERCENT, "PERCENT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(PERCENT_SIGNED_1_POINT, "PERCENT_SIGNED_1_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(PERCENT_SIGNED_2_POINT, "PERCENT_SIGNED_2_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(PERCENT_SIGNED_3_POINT, "PERCENT_SIGNED_3_POINT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(PERCENT_SIGNED, "PERCENT_SIGNED", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(SI_1_DIGIT, "SI_1_DIGIT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(SI_2_DIGIT, "SI_2_DIGIT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(SI_3_DIGIT, "SI_3_DIGIT", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(SI, "SI", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(SMART_NUMBER, "SMART_NUMBER", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(SMART_NUMBER_SIGNED, "SMART_NUMBER_SIGNED", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(NumberFormats, "NumberFormats", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/NumberFormats.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();