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
import { FilterXSS, getDefaultWhiteList } from 'xss';
import { DataRecordValue } from '@superset-ui/chart';
import { DataColumnMeta } from '../types';

const xss = new FilterXSS({
  whiteList: {
    ...getDefaultWhiteList(),
    span: ['style', 'class', 'title'],
    div: ['style', 'class'],
    a: ['style', 'class', 'href', 'title', 'target'],
    img: ['style', 'class', 'src', 'alt', 'title', 'width', 'height'],
  },
  stripIgnoreTag: true,
  css: false,
});

function isProbablyHTML(text: string) {
  return /<[^>]+>/.test(text);
}
/**
 * Format text for cell value
 */
export default function formatValue(
  { formatter }: DataColumnMeta,
  value: DataRecordValue,
): [boolean, string] {
  if (value === null) {
    return [false, 'N/A'];
  }
  if (formatter) {
    // in case percent metric can specify percent format in the future
    return [false, formatter(value as number)];
  }
  if (typeof value === 'string') {
    return isProbablyHTML(value) ? [true, xss.process(value)] : [false, value];
  }
  return [false, value.toString()];
}
