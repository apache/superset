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
import { formatNumber } from '@superset-ui/core';

function formatCellValue(
i,
cols,
tdText,
columnFormats,
numberFormat,
dateRegex,
dateFormatter)
{
  const metric = cols[i];
  const format = columnFormats[metric] || numberFormat || '.3s';
  let textContent = tdText;
  let sortAttributeValue = tdText;

  if (parseFloat(tdText)) {
    const parsedValue = parseFloat(tdText);
    textContent = formatNumber(format, parsedValue);
    sortAttributeValue = parsedValue;
  } else {
    const regexMatch = dateRegex.exec(tdText);
    if (regexMatch) {
      const date = new Date(parseFloat(regexMatch[1]));
      textContent = dateFormatter(date);
      sortAttributeValue = date;
    } else if (tdText === 'null') {
      textContent = '';
      sortAttributeValue = Number.NEGATIVE_INFINITY;
    }
  }

  return { textContent, sortAttributeValue };
}

function formatDateCellValue(
text,
verboseMap,
dateRegex,
dateFormatter)
{
  const regexMatch = dateRegex.exec(text);
  let cellValue;
  if (regexMatch) {
    const date = new Date(parseFloat(regexMatch[1]));
    cellValue = dateFormatter(date);
  } else {
    cellValue = verboseMap[text] || text;
  }
  return cellValue;
}

export { formatCellValue, formatDateCellValue };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(formatCellValue, "formatCellValue", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-pivot-table/src/utils/formatCells.ts");reactHotLoader.register(formatDateCellValue, "formatDateCellValue", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-pivot-table/src/utils/formatCells.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();