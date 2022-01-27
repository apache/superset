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

import {



isUnaryOperator,
isBinaryOperator,
isSetOperator } from
'./Operator';





































//---------------------------------------------------
// Type guards
//---------------------------------------------------

export function isSimpleAdhocFilter(
filter)
{
  return filter.expressionType === 'SIMPLE';
}

export function isUnaryAdhocFilter(
filter)
{
  return isUnaryOperator(filter.operator);
}

export function isBinaryAdhocFilter(
filter)
{
  return isBinaryOperator(filter.operator);
}

export function isSetAdhocFilter(
filter)
{
  return isSetOperator(filter.operator);
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(isSimpleAdhocFilter, "isSimpleAdhocFilter", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/Filter.ts");reactHotLoader.register(isUnaryAdhocFilter, "isUnaryAdhocFilter", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/Filter.ts");reactHotLoader.register(isBinaryAdhocFilter, "isBinaryAdhocFilter", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/Filter.ts");reactHotLoader.register(isSetAdhocFilter, "isSetAdhocFilter", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/types/Filter.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();