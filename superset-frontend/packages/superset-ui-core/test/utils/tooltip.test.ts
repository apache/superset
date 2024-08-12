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
import { tooltipHtml } from '@superset-ui/core';

const TITLE_STYLE =
  'style="font-weight: 700;max-width:300px;overflow:hidden;text-overflow:ellipsis;"';
const TR_STYLE = 'style="opacity:0.8;"';
const TR_FOCUS_STYLE = 'style="font-weight:700;"';
const TD_TEXT_STYLE =
  'style="text-align:left;padding-left:0px;max-width:300px;overflow:hidden;text-overflow:ellipsis;"';
const TD_NUMBER_STYLE =
  'style="text-align:right;padding-left:16px;max-width:300px;overflow:hidden;text-overflow:ellipsis;"';

const data = [
  ['a', 'b', 'c'],
  ['1', '2', '3'],
];

function removeWhitespaces(text: string) {
  return text.replace(/\s/g, '');
}

test('should return a table with the given data', () => {
  const title = 'Title';
  const html = removeWhitespaces(tooltipHtml(data, title));
  const expectedHtml = removeWhitespaces(`
    <div>
        <span ${TITLE_STYLE}>Title</span>
        <table>
            <tr ${TR_STYLE}>
                <td ${TD_TEXT_STYLE}>a</td>
                <td ${TD_NUMBER_STYLE}>b</td>
                <td ${TD_NUMBER_STYLE}>c</td>
            </tr>
            <tr ${TR_STYLE}>
                <td ${TD_TEXT_STYLE}>1</td>
                <td ${TD_NUMBER_STYLE}>2</td>
                <td ${TD_NUMBER_STYLE}>3</td>
            </tr>
        </table>
    </div>`);
  expect(html).toMatch(expectedHtml);
});

test('should return a table with the given data and a focused row', () => {
  const title = 'Title';
  const focusedRow = 1;
  const html = removeWhitespaces(tooltipHtml(data, title, focusedRow));
  const expectedHtml = removeWhitespaces(`
    <div>
        <span ${TITLE_STYLE}>Title</span>
        <table>
            <tr ${TR_STYLE}>
                <td ${TD_TEXT_STYLE}>a</td>
                <td ${TD_NUMBER_STYLE}>b</td>
                <td ${TD_NUMBER_STYLE}>c</td>
            </tr>
            <tr ${TR_FOCUS_STYLE}>
                <td ${TD_TEXT_STYLE}>1</td>
                <td ${TD_NUMBER_STYLE}>2</td>
                <td ${TD_NUMBER_STYLE}>3</td>
            </tr>
        </table>
    </div>`);
  expect(html).toMatch(expectedHtml);
});

test('should return a table with no data', () => {
  const title = 'Title';
  const html = removeWhitespaces(tooltipHtml([], title));
  const expectedHtml = removeWhitespaces(`
    <div>
        <span ${TITLE_STYLE}>Title</span>
        <table>
            <tr><td>No data</td></tr>
        </table>
    </div>`);
  expect(html).toMatch(expectedHtml);
});

test('should return a table with the given data and no title', () => {
  const html = removeWhitespaces(tooltipHtml(data));
  const expectedHtml = removeWhitespaces(`
    <div>
        <table>
            <tr ${TR_STYLE}>
                <td ${TD_TEXT_STYLE}>a</td>
                <td ${TD_NUMBER_STYLE}>b</td>
                <td ${TD_NUMBER_STYLE}>c</td>
            </tr>
            <tr ${TR_STYLE}>
                <td ${TD_TEXT_STYLE}>1</td>
                <td ${TD_NUMBER_STYLE}>2</td>
                <td ${TD_NUMBER_STYLE}>3</td>
            </tr>
        </table>
    </div>`);
  expect(html).toMatch(expectedHtml);
});
