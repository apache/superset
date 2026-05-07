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
import {
  SupersetClient,
  getTimeFormatter,
  TimeFormats,
  ensureIsArray,
} from '@superset-ui/core';

// ATTENTION: If you change any constants, make sure to also change constants.py

export const EMPTY_STRING = '<empty string>';
export const NULL_STRING = '<NULL>';
export const TRUE_STRING = 'TRUE';
export const FALSE_STRING = 'FALSE';

// dayjs time format strings
export const SHORT_DATE = 'MMM D, YYYY';
export const SHORT_TIME = 'h:m a';

const DATETIME_FORMATTER = getTimeFormatter(TimeFormats.DATABASE_DATETIME);

export function storeQuery(query) {
  return SupersetClient.post({
    endpoint: '/kv/store/',
    postPayload: { data: query },
  }).then(response => {
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?id=${response.json.id}`;
    return url;
  });
}

export function optionLabel(opt) {
  if (opt === null) {
    return NULL_STRING;
  }
  if (opt === '') {
    return EMPTY_STRING;
  }
  if (opt === true) {
    return TRUE_STRING;
  }
  if (opt === false) {
    return FALSE_STRING;
  }
  if (typeof opt !== 'string' && opt.toString) {
    return opt.toString();
  }
  return opt;
}

export function optionValue(opt) {
  if (opt === null) {
    return NULL_STRING;
  }
  return opt;
}

export function optionFromValue(opt) {
  // From a list of options, handles special values & labels
  return { value: optionValue(opt), label: optionLabel(opt) };
}

function getColumnName(column) {
  return column.name || column;
}

export function prepareCopyToClipboardTabularData(data, columns) {
  let result = columns.length
    ? `${columns.map(getColumnName).join('\t')}\n`
    : '';
  for (let i = 0; i < data.length; i += 1) {
    const row = {};
    for (let j = 0; j < columns.length; j += 1) {
      // JavaScript does not maintain the order of a mixed set of keys (i.e integers and strings)
      // the below function orders the keys based on the column names.
      const key = getColumnName(columns[j]);
      if (key in data[i]) {
        row[j] = data[i][key];
      } else {
        row[j] = data[i][parseFloat(key)];
      }
    }
    result += `${Object.values(row).join('\t')}\n`;
  }
  return result;
}

export function applyFormattingToTabularData(data, timeFormattedColumns) {
  if (
    !data ||
    data.length === 0 ||
    ensureIsArray(timeFormattedColumns).length === 0
  ) {
    return data;
  }

  return data.map(row => ({
    ...row,
    /* eslint-disable no-underscore-dangle */
    ...timeFormattedColumns.reduce((acc, colName) => {
      if (row[colName] !== null && row[colName] !== undefined) {
        acc[colName] = DATETIME_FORMATTER(row[colName]);
      }
      return acc;
    }, {}),
  }));
}

export const noOp = () => undefined;

// Detects the user's OS through the browser
export const detectOS = () => {
  const { appVersion } = navigator;

  // Leveraging this condition because of stackOverflow
  // https://stackoverflow.com/questions/11219582/how-to-detect-my-browser-version-and-operating-system-using-javascript
  if (appVersion.includes('Win')) return 'Windows';
  if (appVersion.includes('Mac')) return 'MacOS';
  if (appVersion.includes('X11')) return 'UNIX';
  if (appVersion.includes('Linux')) return 'Linux';

  return 'Unknown OS';
};

export const isSafari = () => {
  const { userAgent } = navigator;

  return userAgent && /^((?!chrome|android).)*safari/i.test(userAgent);
};
