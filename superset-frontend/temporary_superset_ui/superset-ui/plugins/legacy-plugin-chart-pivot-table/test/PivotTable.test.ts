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
import { getTimeFormatterForGranularity } from '@superset-ui/core';
import { formatCellValue } from '../src/utils/formatCells';

describe('pivot table plugin format cells', () => {
  const i = 0;
  const cols = ['SUM'];
  let tdText = '2222222';
  const columnFormats = {};
  const numberFormat = 'SMART_NUMBER';
  const dateRegex = /^__timestamp:(-?\d*\.?\d*)$/;
  const dateFormatter = getTimeFormatterForGranularity('P1D');

  it('render number', () => {
    const { textContent, sortAttributeValue } = formatCellValue(
      i,
      cols,
      tdText,
      columnFormats,
      numberFormat,
      dateRegex,
      dateFormatter,
    );
    expect(textContent).toEqual('2.22M');
    expect(sortAttributeValue).toEqual(2222222);
  });

  it('render date', () => {
    tdText = '__timestamp:-126230400000.0';

    const { textContent } = formatCellValue(
      i,
      cols,
      tdText,
      columnFormats,
      numberFormat,
      dateRegex,
      dateFormatter,
    );
    expect(textContent).toEqual('1966-01-01');
  });

  it('render string', () => {
    tdText = 'some-text';

    const { textContent, sortAttributeValue } = formatCellValue(
      i,
      cols,
      tdText,
      columnFormats,
      numberFormat,
      dateRegex,
      dateFormatter,
    );
    expect(textContent).toEqual(tdText);
    expect(sortAttributeValue).toEqual(tdText);
  });

  it('render null', () => {
    tdText = 'null';

    const { textContent, sortAttributeValue } = formatCellValue(
      i,
      cols,
      tdText,
      columnFormats,
      numberFormat,
      dateRegex,
      dateFormatter,
    );
    expect(textContent).toEqual('');
    expect(sortAttributeValue).toEqual(Number.NEGATIVE_INFINITY);
  });
});
