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
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { AGGREGATES } from 'src/explore/constants';
import AdhocMetric from './AdhocMetric';
import AdhocMetricPopoverTrigger, {
  AdhocMetricPopoverTriggerProps,
} from './AdhocMetricPopoverTrigger';

const columns = [
  { type: 'VARCHAR(255)', column_name: 'source' },
  { type: 'DOUBLE', column_name: 'value' },
];

const savedMetricsOptions = [
  { id: 1, metric_name: 'count', expression: 'COUNT(*)' },
  { id: 2, metric_name: 'sum_value', expression: 'SUM(value)' },
];

const createAdhocMetric = (column = columns[1]) =>
  new AdhocMetric({ column, aggregate: AGGREGATES.SUM });

const TRIGGER_TEXT = 'open metric popover';

const createProps = (
  overrides: Partial<AdhocMetricPopoverTriggerProps> = {},
): AdhocMetricPopoverTriggerProps => ({
  adhocMetric: createAdhocMetric(),
  onMetricEdit: jest.fn(),
  columns,
  savedMetricsOptions,
  savedMetric: {},
  datasource: {
    type: 'table',
    id: 1,
    uid: '1__table',
    columnFormats: {},
    verboseMap: {},
  } as unknown as AdhocMetricPopoverTriggerProps['datasource'],
  children: <button type="button">{TRIGGER_TEXT}</button>,
  ...overrides,
});

const renderOptions = {
  useRedux: true,
  initialState: { explore: {} },
};

const renderTrigger = (
  overrides: Partial<AdhocMetricPopoverTriggerProps> = {},
) => {
  const props = createProps(overrides);
  const utils = render(<AdhocMetricPopoverTrigger {...props} />, renderOptions);
  return {
    ...utils,
    props,
    rerenderWith: (next: Partial<AdhocMetricPopoverTriggerProps>) =>
      utils.rerender(<AdhocMetricPopoverTrigger {...props} {...next} />),
  };
};

const popover = () => screen.queryByTestId('metrics-edit-popover');
const titleTrigger = () => screen.queryByTestId('AdhocMetricEditTitle#trigger');
const readOnlyTitle = () => screen.queryByTestId('AdhocMetricTitle');

async function renameMetricTo(label: string) {
  await userEvent.click(screen.getByTestId('AdhocMetricEditTitle#trigger'));
  const input = await screen.findByTestId('AdhocMetricEditTitle#input');
  await userEvent.clear(input);
  await userEvent.type(input, label);
  fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
}

test('uncontrolled: clicking the child opens the popover and Close dismisses it', async () => {
  renderTrigger();
  expect(popover()).not.toBeInTheDocument();

  await userEvent.click(screen.getByText(TRIGGER_TEXT));
  expect(await screen.findByTestId('metrics-edit-popover')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(popover()).not.toBeInTheDocument());
});

test('controlled: visible=true shows the popover without any interaction', async () => {
  renderTrigger({ isControlledComponent: true, visible: true });

  expect(await screen.findByTestId('metrics-edit-popover')).toBeInTheDocument();
});

test('controlled: visible=false keeps the popover closed', () => {
  renderTrigger({ isControlledComponent: true, visible: false });

  expect(popover()).not.toBeInTheDocument();
});

test('controlled: clicking the child reports the request through togglePopover', async () => {
  const togglePopover = jest.fn();
  renderTrigger({
    isControlledComponent: true,
    visible: false,
    togglePopover,
  });

  await userEvent.click(screen.getByText(TRIGGER_TEXT));

  expect(togglePopover).toHaveBeenCalledWith(true);
});

test('controlled: Close calls the closePopover prop', async () => {
  const closePopover = jest.fn();
  renderTrigger({
    isControlledComponent: true,
    visible: true,
    togglePopover: jest.fn(),
    closePopover,
  });

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }));

  expect(closePopover).toHaveBeenCalledTimes(1);
});

test('controlled: the visible prop drives the popover across rerenders', async () => {
  const { rerenderWith } = renderTrigger({
    isControlledComponent: true,
    visible: false,
    togglePopover: jest.fn(),
  });
  expect(popover()).not.toBeInTheDocument();

  rerenderWith({ visible: true });
  expect(await screen.findByTestId('metrics-edit-popover')).toBeInTheDocument();

  rerenderWith({ visible: false });
  await waitFor(() => expect(popover()).not.toBeInTheDocument());
});

test('title editing is disabled while the Saved tab is active', async () => {
  renderTrigger({
    adhocMetric: new AdhocMetric({}),
    savedMetric: savedMetricsOptions[0],
  });

  await userEvent.click(screen.getByText(TRIGGER_TEXT));

  expect(await screen.findByTestId('AdhocMetricTitle')).toHaveTextContent(
    'count',
  );
  expect(titleTrigger()).not.toBeInTheDocument();
});

test('title editing is enabled on the Simple tab', async () => {
  renderTrigger();

  await userEvent.click(screen.getByText(TRIGGER_TEXT));

  expect(
    await screen.findByTestId('AdhocMetricEditTitle#trigger'),
  ).toBeInTheDocument();
  expect(readOnlyTitle()).not.toBeInTheDocument();
});

test('title editing follows the active tab when switching between Saved and Simple', async () => {
  renderTrigger({
    adhocMetric: new AdhocMetric({}),
    savedMetric: savedMetricsOptions[0],
  });
  await userEvent.click(screen.getByText(TRIGGER_TEXT));
  expect(await screen.findByTestId('AdhocMetricTitle')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('tab', { name: 'Simple' }));
  expect(
    await screen.findByTestId('AdhocMetricEditTitle#trigger'),
  ).toBeInTheDocument();
  expect(readOnlyTitle()).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('tab', { name: 'Saved' }));
  expect(await screen.findByTestId('AdhocMetricTitle')).toBeInTheDocument();
  expect(titleTrigger()).not.toBeInTheDocument();
});

test('a custom title survives a rerender with the same optionName', async () => {
  const { props, rerenderWith } = renderTrigger();
  await userEvent.click(screen.getByText(TRIGGER_TEXT));
  await renameMetricTo('my custom label');
  expect(
    await screen.findByTestId('AdhocMetricEditTitle#trigger'),
  ).toHaveTextContent('my custom label');

  rerenderWith({
    adhocMetric: new AdhocMetric({
      ...props.adhocMetric,
      optionName: props.adhocMetric.optionName,
    }),
  });

  expect(screen.getByTestId('AdhocMetricEditTitle#trigger')).toHaveTextContent(
    'my custom label',
  );
});

test('an external optionName change resets the edited title to the new metric label', async () => {
  const { rerenderWith } = renderTrigger();
  await userEvent.click(screen.getByText(TRIGGER_TEXT));
  await renameMetricTo('my custom label');
  expect(
    await screen.findByTestId('AdhocMetricEditTitle#trigger'),
  ).toHaveTextContent('my custom label');

  rerenderWith({ adhocMetric: createAdhocMetric(columns[0]) });

  await waitFor(() => {
    expect(
      screen.getByTestId('AdhocMetricEditTitle#trigger'),
    ).toHaveTextContent('SUM(source)');
  });
  expect(screen.queryByText('my custom label')).not.toBeInTheDocument();
});

test('an external optionName change adopts the custom label of the new metric', async () => {
  const { rerenderWith } = renderTrigger();
  await userEvent.click(screen.getByText(TRIGGER_TEXT));
  await renameMetricTo('my custom label');

  rerenderWith({
    adhocMetric: new AdhocMetric({
      column: columns[0],
      aggregate: AGGREGATES.MAX,
      hasCustomLabel: true,
      label: 'label from elsewhere',
    }),
  });

  await waitFor(() => {
    expect(
      screen.getByTestId('AdhocMetricEditTitle#trigger'),
    ).toHaveTextContent('label from elsewhere');
  });
});

test('saving passes the edited title to onMetricEdit', async () => {
  const { props } = renderTrigger();
  await userEvent.click(screen.getByText(TRIGGER_TEXT));
  await renameMetricTo('my custom label');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(props.onMetricEdit).toHaveBeenCalledWith(
    expect.objectContaining({
      label: 'my custom label',
      hasCustomLabel: true,
    }),
    props.adhocMetric,
  );
});
