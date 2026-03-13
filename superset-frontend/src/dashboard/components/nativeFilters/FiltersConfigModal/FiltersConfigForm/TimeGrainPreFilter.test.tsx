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
import { Form, Select } from '@superset-ui/core/components';
import { CollapsibleControl } from './CollapsibleControl';
import { getTimeGrainOptions } from './utils';

/**
 * Tests for the Time Grain Pre-filter feature (CollapsibleControl + Select).
 *
 * These tests verify:
 * - Options are rendered in database order (no client-side sorting)
 * - A saved subset of time_grains is loaded and shown as selected values
 * - The CollapsibleControl checkbox shows/hides the Select
 * - Toggling the checkbox off clears the underlying selection
 */

const TIME_GRAIN_TUPLES: [string, string][] = [
  ['PT1S', 'Second'],
  ['PT1M', 'Minute'],
  ['PT1H', 'Hour'],
  ['P1D', 'Day'],
  ['P1W', 'Week'],
];

const renderPreFilter = (props: {
  savedGrains?: string[];
  initialChecked?: boolean;
  onChangeMock?: jest.Mock;
}) => {
  const {
    savedGrains,
    initialChecked = false,
    onChangeMock = jest.fn(),
  } = props;
  const options = getTimeGrainOptions(TIME_GRAIN_TUPLES);
  return render(
    <Form>
      <CollapsibleControl
        title="Pre-filter available values"
        initialValue={initialChecked}
        onChange={onChangeMock}
      >
        <Form.Item name="time_grains" initialValue={savedGrains}>
          <Select
            mode="multiple"
            ariaLabel="Time grain options"
            options={options}
            sortComparator={() => 0}
          />
        </Form.Item>
      </CollapsibleControl>
    </Form>,
  );
};

test('time grain options preserve database order (no sorting)', () => {
  const options = getTimeGrainOptions(TIME_GRAIN_TUPLES);
  const labels = options.map(option => option.label);

  // Options must follow database order: Second, Minute, Hour, Day, Week
  expect(labels).toEqual(['Second', 'Minute', 'Hour', 'Day', 'Week']);
});

test('saved time grains are loaded as selected values', () => {
  renderPreFilter({ savedGrains: ['P1D', 'P1W'], initialChecked: true });

  expect(screen.getByText('Day')).toBeInTheDocument();
  expect(screen.getByText('Week')).toBeInTheDocument();
  expect(screen.queryByText('Second')).not.toBeInTheDocument();
});

test('CollapsibleControl checkbox shows and hides the grain Select', async () => {
  renderPreFilter({});

  // Initially unchecked — select should be hidden
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

  const checkbox = screen.getByRole('checkbox', {
    name: /Pre-filter available values/i,
  });
  await userEvent.click(checkbox);

  // After checking — select should appear
  expect(screen.getByRole('combobox')).toBeInTheDocument();

  await userEvent.click(checkbox);

  // After unchecking — select should disappear
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

test('CollapsibleControl starts expanded when initialValue is true', () => {
  renderPreFilter({ initialChecked: true });

  // When initialValue=true the checkbox is checked and children are visible
  expect(screen.getByRole('combobox')).toBeInTheDocument();
  const checkbox = screen.getByRole('checkbox', {
    name: /Pre-filter available values/i,
  });
  expect(checkbox).toBeChecked();
});

test('onChange is called with correct value when checkbox is toggled', async () => {
  const onChangeMock = jest.fn();
  renderPreFilter({ onChangeMock });

  const checkbox = screen.getByRole('checkbox', {
    name: /Pre-filter available values/i,
  });
  await userEvent.click(checkbox);
  expect(onChangeMock).toHaveBeenCalledWith(true);

  await userEvent.click(checkbox);
  expect(onChangeMock).toHaveBeenCalledWith(false);
});
