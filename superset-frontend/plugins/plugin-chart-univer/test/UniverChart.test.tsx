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
import { act, render } from '@superset-ui/core/spec';
import { GenericDataType } from '@apache-superset/core/common';
import UniverChart from '../src/UniverChart';
import { mountUniver } from '../src/univer/mountUniver';
import { MountUniverOptions, WorkbookData } from '../src/runtimeTypes';
import { UniverChartProps, WORKBOOK_CONTROL } from '../src/types';

jest.mock('../src/univer/mountUniver', () => ({ mountUniver: jest.fn() }));

const mockMount = mountUniver as jest.MockedFunction<typeof mountUniver>;

const props: UniverChartProps = {
  width: 400,
  height: 300,
  data: [
    { name: 'a', total: 1 },
    { name: 'b', total: 2 },
  ],
  colnames: ['name', 'total'],
  coltypes: [GenericDataType.String, GenericDataType.Numeric],
  labels: { total: 'Total' },
  editable: true,
  savedState: null,
  liveData: true,
  showHeaders: false,
};

let saved: WorkbookData;

beforeEach(() => {
  jest.useFakeTimers();
  mockMount.mockReset();
  mockMount.mockImplementation(({ workbook }: MountUniverOptions) => {
    saved = workbook;
    return {
      save: () => saved,
      setColumnWidths: jest.fn(),
      dispose: jest.fn(),
    };
  });
});

afterEach(() => {
  jest.useRealTimers();
});

const firstSheetId = (workbook: WorkbookData) =>
  Object.keys(workbook.sheets ?? {})[0];
const firstSheet = (workbook: WorkbookData) =>
  workbook.sheets?.[firstSheetId(workbook)] ?? {};

test('mounts the query result as an editable sheet in Explore', () => {
  render(<UniverChart {...props} />);
  expect(mockMount).toHaveBeenCalledTimes(1);
  const options = mockMount.mock.calls[0][0];
  expect(options.editable).toBe(true);
  expect(options.onChange).toBeDefined();
  const { cellData } = firstSheet(options.workbook);
  expect(cellData?.[0]?.[0]?.v).toBe('name');
  expect(cellData?.[0]?.[1]?.v).toBe('Total');
  expect(cellData?.[2]?.[1]?.v).toBe(2);
});

test('mounts a read-only sheet outside Explore', () => {
  render(<UniverChart {...props} editable={false} />);
  const options = mockMount.mock.calls[0][0];
  expect(options.editable).toBe(false);
  expect(options.onChange).toBeUndefined();
});

test('saves edits to the workbook control', () => {
  const setControlValue = jest.fn();
  render(<UniverChart {...props} setControlValue={setControlValue} />);
  const { onChange } = mockMount.mock.calls[0][0];
  const sheet = firstSheet(saved);
  saved = {
    ...saved,
    sheets: {
      [firstSheetId(saved)]: {
        ...sheet,
        cellData: {
          ...sheet.cellData,
          0: { ...sheet.cellData?.[0], 1: { v: 'Renamed' } },
        },
      },
    },
  };
  act(() => {
    onChange?.();
    jest.runAllTimers();
  });
  expect(setControlValue).toHaveBeenCalledTimes(1);
  const [control, state] = setControlValue.mock.calls[0];
  expect(control).toBe(WORKBOOK_CONTROL);
  expect(state).toContain('Renamed');
});

test('does not remount Univer when its own save comes back as props', () => {
  const setControlValue = jest.fn();
  const { rerender } = render(
    <UniverChart {...props} setControlValue={setControlValue} />,
  );
  const { onChange } = mockMount.mock.calls[0][0];
  saved = { ...saved, name: 'edited' };
  act(() => {
    onChange?.();
    jest.runAllTimers();
  });
  const [, state] = setControlValue.mock.calls[0];
  rerender(
    <UniverChart
      {...props}
      savedState={state}
      setControlValue={setControlValue}
    />,
  );
  expect(mockMount).toHaveBeenCalledTimes(1);
});
