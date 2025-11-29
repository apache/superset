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

import { render, screen, userEvent } from 'spec/helpers/testing-library';
import type { Dayjs } from '@superset-ui/core/utils/dates';
import { JalaliDatePicker } from 'src/explore/components/controls/DateFilterControl/components/JalaliDatePicker';

jest.mock('react-resize-detector', () => ({
  useResizeDetector: () => ({ ref: jest.fn(), width: 0 }),
}));

jest.mock('react-multi-date-picker', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange([{ year: Number.NaN, month: undefined, day: undefined }])
      }
    >
      Trigger invalid date
    </button>
  ),
}));

test('returns empty range when conversion fails', async () => {
  const handleChange =
    jest.fn<(range: [Dayjs | null, Dayjs | null]) => void>();

  render(
    <JalaliDatePicker
      mode="range"
      value={[null, null] as [Dayjs | null, Dayjs | null]}
      onChange={handleChange}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: /invalid date/i }));

  expect(handleChange).toHaveBeenCalledWith([null, null]);
});
