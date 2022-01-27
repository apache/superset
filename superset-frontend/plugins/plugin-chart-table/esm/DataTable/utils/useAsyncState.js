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
import { useRef, useState } from 'react';
import { useAsyncDebounce } from 'react-table';

// useAsyncDebounce in dist build of `react-table` requires regeneratorRuntime
import 'regenerator-runtime/runtime';

/**
 * Hook useState to allow always return latest initialValue
 */
export default function useAsyncState(
initialValue,
callback,
wait = 200)
{
  const [value, setValue] = useState(initialValue);
  const valueRef = useRef(initialValue);
  const onChange = useAsyncDebounce(callback, wait);

  // sync updated initialValue
  if (valueRef.current !== initialValue) {
    valueRef.current = initialValue;
    if (value !== initialValue) {
      setValue(initialValue);
    }
  }

  const setBoth = (newValue) => {
    setValue(newValue);
    onChange(newValue);
  };

  return [value, setBoth];
}__signature__(useAsyncState, "useState{[value, setValue](initialValue)}\nuseRef{valueRef}\nuseAsyncDebounce{onChange}", () => [useAsyncDebounce]);;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(useAsyncState, "useAsyncState", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/utils/useAsyncState.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();