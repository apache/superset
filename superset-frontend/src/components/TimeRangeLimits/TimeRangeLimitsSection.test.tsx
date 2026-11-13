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
import { useState } from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import {
  DraftPolicy,
  Policy,
  Rule,
  SaveCheckChart,
  SaveCheckResult,
} from 'src/utils/timeRangeLimits';
import TimeRangeLimitsSection, {
  TimeRangeLimitsSectionProps,
} from './TimeRangeLimitsSection';
import { toDraft, validateTimeRangeLimits } from './policyDraft';
import { SaveCheck } from './useSaveCheck';

jest.setTimeout(60000);

const rule = (quantity: number, timeGrain: string): Rule => ({
  quantity,
  time_grain: timeGrain,
});

const policy = (rules: Partial<Policy> = {}): Policy => ({
  max_span: null,
  max_look_back: null,
  max_look_forward: null,
  ...rules,
});

const GRAINS = [
  { value: 'PT1H', label: 'Hour' },
  { value: 'P1D', label: 'Day' },
  { value: 'P1W', label: 'Week' },
  { value: 'P1M', label: 'Month' },
  { value: 'P1Y', label: 'Year' },
];

type HarnessProps = Partial<TimeRangeLimitsSectionProps> & {
  initial?: DraftPolicy;
};

function Harness({ initial, ...props }: HarnessProps) {
  const stored = props.stored ?? policy();
  const global = props.global ?? null;
  const [value, setValue] = useState(initial ?? toDraft(stored));
  const state = props.state ?? 'ready';
  const errors =
    props.errors ??
    (state === 'ready'
      ? validateTimeRangeLimits({
          global,
          value,
          stored,
        })
      : {});
  return (
    <TimeRangeLimitsSection
      level="dashboard"
      needsReview={[]}
      eligibleTimeGrains={GRAINS}
      saveFailed={false}
      removing={false}
      showApplyNote={false}
      onRetry={jest.fn()}
      onRetrySave={jest.fn()}
      {...props}
      global={global}
      stored={stored}
      state={state}
      errors={errors}
      value={value}
      onChange={next => {
        setValue(next);
        props.onChange?.(next);
      }}
    />
  );
}

const row = (name: RegExp) => screen.getByRole('row', { name });
const cells = (name: RegExp) => within(row(name)).getAllByRole('cell');
const fieldErrorRegion = () => {
  const [table] = screen.getAllByRole('table');
  return (
    Array.from(
      // eslint-disable-next-line testing-library/no-node-access
      document.querySelectorAll<HTMLElement>('[aria-live]:not(.ant-spin)'),
    ).find(
      node =>
        // eslint-disable-next-line no-bitwise
        table.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ) ?? null
  );
};
const quantity = (label: string) =>
  screen.getByRole('spinbutton', { name: `${label} quantity` });
const unit = (label: string) =>
  screen.getByRole('combobox', { name: new RegExp(`^${label} unit`) });

async function setQuantity(label: string, value: string) {
  await userEvent.clear(quantity(label));
  if (value) {
    await userEvent.type(quantity(label), value);
  }
}

async function pickUnit(label: string, option: string) {
  await userEvent.click(unit(label));
  const item = await waitFor(() =>
    within(
      // eslint-disable-next-line testing-library/no-node-access
      document.querySelector('.ant-select-dropdown-list')!,
    ).getByText(option),
  );
  await userEvent.click(item);
}

test('renders the three rules with column headers', () => {
  render(<Harness global={policy({ max_span: rule(12, 'P1W') })} />);

  const region = screen.getByRole('region', { name: 'Time range limits' });
  expect(
    within(region).getByText(
      'These limits apply to every time range filter and temporal chart query on this dashboard.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getAllByRole('columnheader').map(header => header.textContent),
  ).toEqual(['Rule', 'Global', 'Dashboard', 'Effective']);
  expect(
    screen
      .getAllByRole('row')
      .slice(1)
      .map(item => within(item).getAllByRole('cell')[0].textContent),
  ).toEqual([
    'Longest rangeStart-to-end duration.',
    'Earliest startEarliest start from now.',
    'Latest endLatest end from now.',
  ]);
  expect(cells(/Longest range/)[1]).toHaveTextContent('12 weeks');
  expect(cells(/Earliest start/)[1]).toHaveTextContent('No limit');
});

test('loading disables the fields', () => {
  render(<Harness state="loading" pending />);

  expect(
    screen.getByRole('region', { name: 'Time range limits' }),
  ).toHaveAttribute('aria-busy', 'true');
  ['Longest range', 'Earliest start', 'Latest end'].forEach(label => {
    expect(quantity(label)).toBeDisabled();
    expect(unit(label)).toBeDisabled();
  });
  expect(cells(/Longest range/)[1]).toHaveTextContent('');
  expect(cells(/Longest range/)[3]).toHaveTextContent('');
});

test.each(['dashboard', 'dataset'] as const)(
  'no eligible units, %s level',
  level => {
    render(
      <Harness
        level={level}
        state="noUnits"
        eligibleTimeGrains={[]}
        stored={policy({ max_span: rule(4, 'P1W') })}
      />,
    );

    expect(
      screen.getByText('No eligible time grains configured'),
    ).toBeInTheDocument();
    expect(quantity('Longest range')).toBeDisabled();
    expect(quantity('Longest range')).toHaveValue('4');
    expect(unit('Latest end')).toBeDisabled();
    expect(
      screen.getByRole('region', { name: 'Time range limits' }),
    ).not.toHaveAttribute('aria-busy');
  },
);

test('effective column', async () => {
  render(
    <Harness
      global={policy({
        max_span: rule(1, 'P1Y'),
        max_look_back: rule(2, 'P1D'),
      })}
      stored={policy({ max_look_back: rule(49, 'PT1H') })}
    />,
  );

  expect(cells(/Longest range/)[3]).toHaveTextContent('1 year');
  expect(cells(/Latest end/)[3]).toHaveTextContent('No limit');
  expect(cells(/Earliest start/)[3]).toHaveTextContent(
    '2 days ago and 49 hours ago; both enforced',
  );

  await setQuantity('Longest range', '90');
  expect(cells(/Longest range/)[3]).toHaveTextContent('1 year');
  await pickUnit('Longest range', 'Day');
  expect(cells(/Longest range/)[3]).toHaveTextContent('90 days');

  await setQuantity('Earliest start', '');
  expect(cells(/Earliest start/)[3]).toHaveTextContent('2 days ago');
});

test('looser than global', async () => {
  const { unmount } = render(
    <Harness
      global={policy({ max_span: rule(12, 'P1W') })}
      stored={policy({ max_span: rule(12, 'P1W') })}
    />,
  );

  await setQuantity('Longest range', '13');
  const message = await screen.findByText(
    "Can't be longer than the admin limit (12 weeks)",
  );
  expect(quantity('Longest range')).toHaveAttribute('aria-invalid', 'true');
  expect(quantity('Longest range')).toHaveAttribute(
    'aria-describedby',
    message.id,
  );
  unmount();

  render(<Harness global={policy({ max_span: rule(1, 'P1Y') })} />);
  await setQuantity('Longest range', '366');
  await pickUnit('Longest range', 'Day');
  expect(
    await screen.findByText("Can't be longer than the admin limit (1 year)"),
  ).toBeInTheDocument();
  expect(quantity('Longest range')).toHaveAttribute('aria-invalid', 'true');

  await setQuantity('Longest range', '90');
  await waitFor(() =>
    expect(
      screen.queryByText("Can't be longer than the admin limit (1 year)"),
    ).not.toBeInTheDocument(),
  );
  expect(quantity('Longest range')).not.toHaveAttribute('aria-invalid');
});

test.each(['dashboard', 'dataset'] as const)(
  'stale notes, %s level',
  async level => {
    const { unmount } = render(
      <Harness
        level={level}
        global={policy({
          max_span: rule(30, 'P1D'),
          max_look_back: rule(2, 'P1D'),
          max_look_forward: rule(3, 'P1M'),
        })}
        stored={policy({
          max_span: rule(2, 'P1M'),
          max_look_back: rule(48, 'PT1H'),
          max_look_forward: rule(90, 'P1D'),
        })}
        needsReview={[
          { rule: 'max_span', reason: 'LOOSER_THAN_GLOBAL' },
          { rule: 'max_look_back', reason: 'UNIT_MISMATCH' },
          { rule: 'max_look_forward', reason: 'LOOSER_THAN_GLOBAL' },
        ]}
      />,
    );

    const notes = screen.getAllByRole('alert').map(alert => alert.textContent);
    expect(notes).toEqual([
      "Your admin's limit (30 days) is stricter than 2 months, so 30 days applies.",
      `Your admin's limit (2 days) and this ${level}'s limit (48 hours) both apply.`,
      `Your admin's limit (3 months) and this ${level}'s limit (90 days) both apply.`,
    ]);
    expect(screen.queryByText(/Needs review/)).not.toBeInTheDocument();
    // An untouched stale row has no field error.
    expect(quantity('Longest range')).not.toHaveAttribute('aria-invalid');

    await setQuantity('Longest range', '20');
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(
      screen.queryByText(/stricter than 2 months/),
    ).not.toBeInTheDocument();
    unmount();
  },
);

test('datasets with stricter limits', async () => {
  const onChange = jest.fn();
  render(
    <Harness
      global={policy({ max_span: rule(3, 'P1M') })}
      stored={policy({ max_span: rule(90, 'P1D') })}
      onChange={onChange}
      datasets={[
        { id: 1, name: 'Calls', policy: policy({ max_span: rule(4, 'P1W') }) },
        { id: 2, name: 'Equal', policy: policy({ max_span: rule(90, 'P1D') }) },
        {
          id: 3,
          name: 'Looser',
          policy: policy({ max_span: rule(6, 'P1M') }),
        },
        {
          id: 4,
          name: 'Hours',
          policy: policy({
            max_span: rule(48, 'PT1H'),
            max_look_back: rule(1, 'P1W'),
          }),
        },
        { id: 6, name: 'Unset', policy: policy() },
      ]}
    />,
  );

  expect(screen.getByText('Datasets with stricter limits')).toBeInTheDocument();
  expect(
    screen.getByText(
      "Charts on these datasets are held to the dataset's limit.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText('Calls: Longest range 4 weeks')).toBeInTheDocument();
  expect(
    screen.getByText(
      'Hours: Longest range 48 hours · Earliest start 1 week ago',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText(/^Equal:/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Looser:/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Unset/)).not.toBeInTheDocument();
  expect(screen.queryAllByRole('alert')).toHaveLength(0);

  // A half-filled row counts as blank: only the global 3 months applies.
  await pickUnit('Longest range', 'Week');
  await setQuantity('Longest range', '');
  expect(screen.getByText(/^Equal: Longest range 90 days/)).toHaveTextContent(
    'Equal: Longest range 90 days (both limits apply)',
  );
});

test('no dataset list when none is stricter', () => {
  render(
    <Harness
      global={policy({ max_span: rule(4, 'P1W') })}
      datasets={[
        { id: 1, name: 'Calls', policy: policy({ max_span: rule(1, 'P1Y') }) },
      ]}
    />,
  );

  expect(
    screen.queryByText('Datasets with stricter limits'),
  ).not.toBeInTheDocument();
});

test.each(['dashboard', 'dataset'] as const)(
  'accessibility, %s level',
  async level => {
    const onRetry = jest.fn();
    const global = policy({ max_span: rule(12, 'P1W') });
    const { rerender } = render(
      <Harness level={level} global={global} state="loading" pending />,
    );

    const region = screen.getByRole('region', { name: 'Time range limits' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    rerender(<Harness level={level} global={global} />);
    expect(region).not.toHaveAttribute('aria-busy');
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    ['Longest range', 'Earliest start', 'Latest end'].forEach(label => {
      expect(quantity(label)).toBeInTheDocument();
      expect(unit(label)).toBeInTheDocument();
    });

    // The live region exists before any error appears.
    const live = fieldErrorRegion();
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toBeEmptyDOMElement();

    await setQuantity('Longest range', '13');
    await pickUnit('Longest range', 'Week');
    const message = await screen.findByText(
      "Can't be longer than the admin limit (12 weeks)",
    );
    expect(live).toContainElement(message);
    expect(quantity('Longest range')).toHaveAttribute('aria-invalid', 'true');
    expect(quantity('Longest range')).toHaveAttribute(
      'aria-describedby',
      message.id,
    );

    rerender(
      <Harness
        level={level}
        state="failed"
        failure={{ attempt: 1 }}
        onRetry={onRetry}
        key="failed"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Time range limits could not be loaded. Queries are paused to protect the database.',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  },
);

test('time grain error goes on the unit select', async () => {
  render(
    <Harness
      global={policy({ max_look_back: rule(2, 'P1D') })}
      stored={policy({ max_look_back: rule(1, 'P1D') })}
      eligibleTimeGrains={GRAINS}
      errors={{
        'max_look_back.time_grain':
          'Dashboard maximum look-back must be 2 days or less.',
      }}
    />,
  );

  const message = screen.getByText(
    'Dashboard maximum look-back must be 2 days or less.',
  );
  expect(unit('Earliest start')).toHaveAttribute('aria-invalid', 'true');
  expect(unit('Earliest start')).toHaveAttribute(
    'aria-describedby',
    message.id,
  );
  await userEvent.click(unit('Earliest start'));
  const options = await waitFor(() =>
    within(
      // eslint-disable-next-line testing-library/no-node-access
      document.querySelector('.ant-select-dropdown-list')!,
    ).getAllByRole('option'),
  );
  expect(options.map(option => option.textContent)).toEqual([
    'Day',
    'Hour',
    'Week',
    'Month',
    'Year',
  ]);
});

test('a sub-day global offers only sub-day units', async () => {
  render(
    <Harness
      global={policy({ max_look_back: rule(6, 'PT1H') })}
      eligibleTimeGrains={GRAINS}
    />,
  );

  await userEvent.click(unit('Earliest start'));
  const options = await waitFor(() =>
    within(
      // eslint-disable-next-line testing-library/no-node-access
      document.querySelector('.ant-select-dropdown-list')!,
    ).getAllByRole('option'),
  );
  expect(options.map(option => option.textContent)).toEqual(['Hour']);
});

test('an hour limit under a day-based global is accepted until it gets longer', async () => {
  render(
    <Harness
      global={policy({ max_span: rule(3, 'P1M') })}
      eligibleTimeGrains={GRAINS}
    />,
  );

  await setQuantity('Longest range', '72');
  await pickUnit('Longest range', 'Hour');
  expect(cells(/Longest range/)[3]).toHaveTextContent('72 hours');
  expect(screen.queryByText(/admin limit/)).not.toBeInTheDocument();

  await setQuantity('Longest range', '2137');
  expect(
    await screen.findByText("Can't be longer than the admin limit (3 months)"),
  ).toBeInTheDocument();
  expect(quantity('Longest range')).toHaveAttribute('aria-invalid', 'true');
});

test('removing replaces the load failure, and the apply note hides', () => {
  const { rerender } = render(
    <Harness
      state="failed"
      failure={{ attempt: 1, source: 'dashboard', unitValue: 'P1D' }}
      onRemove={jest.fn()}
      showApplyNote
    />,
  );

  expect(
    screen.getByText(
      'Configured time grain P1D is no longer available. Select a supported unit.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getAllByRole('button').map(button => button.textContent),
  ).toEqual(['Retry', 'Remove dashboard limits']);
  expect(
    screen.getByText('Saved when you apply, separately from the dashboard.'),
  ).toBeInTheDocument();

  rerender(
    <Harness
      state="failed"
      failure={{ attempt: 1, source: 'dashboard', unitValue: 'P1D' }}
      onRemove={jest.fn()}
      showApplyNote
      removing
    />,
  );
  expect(
    screen.getByText('Dashboard limits will be removed when you save.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(
    screen.queryByText('Saved when you apply, separately from the dashboard.'),
  ).not.toBeInTheDocument();
});

test('a global load failure offers no removal', () => {
  render(
    <Harness
      state="failed"
      failure={{ attempt: 1, source: 'global' }}
      onRemove={jest.fn()}
    />,
  );

  expect(
    screen.getAllByRole('button').map(button => button.textContent),
  ).toEqual(['Retry']);
});

test('a failed save keeps the values and offers Retry', async () => {
  const onRetrySave = jest.fn();
  render(
    <Harness
      stored={policy({ max_span: rule(4, 'P1W') })}
      saveFailed
      onRetrySave={onRetrySave}
    />,
  );

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Dashboard time range limits could not be saved.',
  );
  expect(quantity('Longest range')).toHaveValue('4');
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(onRetrySave).toHaveBeenCalledTimes(1);
});

test('dataset level copy and rules', async () => {
  const onRetrySave = jest.fn();
  const { unmount } = render(
    <Harness
      level="dataset"
      global={policy({ max_span: rule(12, 'P1W') })}
      stored={policy({ max_span: rule(12, 'P1W') })}
    />,
  );

  expect(
    screen.getAllByRole('columnheader').map(header => header.textContent),
  ).toEqual(['Rule', 'Global', 'Dataset', 'Effective']);
  expect(
    screen.getByText(
      'These limits apply to every temporal chart query on this dataset, in Explore and on dashboards.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/temporal chart query on this dashboard/),
  ).not.toBeInTheDocument();

  await setQuantity('Longest range', '13');
  const message = await screen.findByText(
    "Can't be longer than the admin limit (12 weeks)",
  );
  expect(quantity('Longest range')).toHaveAttribute('aria-invalid', 'true');
  expect(quantity('Longest range')).toHaveAttribute(
    'aria-describedby',
    message.id,
  );
  unmount();

  const second = render(
    <Harness level="dataset" global={policy({ max_span: rule(1, 'P1Y') })} />,
  );
  await setQuantity('Longest range', '366');
  await pickUnit('Longest range', 'Day');
  expect(
    await screen.findByText("Can't be longer than the admin limit (1 year)"),
  ).toBeInTheDocument();
  await setQuantity('Longest range', '90');
  await waitFor(() =>
    expect(
      screen.queryByText("Can't be longer than the admin limit (1 year)"),
    ).not.toBeInTheDocument(),
  );
  expect(cells(/Longest range/)[3]).toHaveTextContent('90 days');
  second.unmount();

  const third = render(
    <Harness
      level="dataset"
      state="failed"
      failure={{ attempt: 1, source: 'dataset', unitValue: 'P1D' }}
      onRemove={jest.fn()}
    />,
  );
  expect(
    screen.getAllByRole('button').map(button => button.textContent),
  ).toEqual(['Retry', 'Remove dataset limits']);
  third.rerender(
    <Harness
      level="dataset"
      state="failed"
      failure={{ attempt: 1, source: 'dataset', unitValue: 'P1D' }}
      onRemove={jest.fn()}
      removing
    />,
  );
  expect(
    screen.getByText('Dataset limits will be removed when you save.'),
  ).toBeInTheDocument();
  third.unmount();

  const fourth = render(
    <Harness
      level="dataset"
      state="failed"
      failure={{ attempt: 1, source: 'dashboard' }}
      onRemove={jest.fn()}
    />,
  );
  expect(
    screen.getAllByRole('button').map(button => button.textContent),
  ).toEqual(['Retry']);
  fourth.unmount();

  render(
    <Harness
      level="dataset"
      stored={policy({ max_span: rule(4, 'P1W') })}
      saveFailed
      onRetrySave={onRetrySave}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Dataset time range limits could not be saved.',
  );
  expect(quantity('Longest range')).toHaveValue('4');
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(onRetrySave).toHaveBeenCalledTimes(1);
});

test('dataset with no time column shows the stored value, disabled', () => {
  const { rerender } = render(
    <Harness
      level="dataset"
      noTimeColumn
      global={policy({ max_span: rule(12, 'P1W') })}
      stored={policy({ max_span: rule(4, 'P1W') })}
      initial={toDraft(policy({ max_span: rule(9, 'P1W') }))}
    />,
  );

  expect(
    screen.getByText(
      "This dataset has no time column, so time range limits don't apply.",
    ),
  ).toBeInTheDocument();
  expect(quantity('Longest range')).toHaveValue('4');
  expect(quantity('Longest range')).toBeDisabled();
  expect(unit('Earliest start')).toBeDisabled();
  expect(cells(/Longest range/)[3]).toHaveTextContent('4 weeks');

  rerender(
    <Harness
      level="dataset"
      noTimeColumn
      state="failed"
      failure={{ attempt: 1 }}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Time range limits could not be loaded. Queries are paused to protect the database.',
  );
  expect(
    screen.queryByText(
      "This dataset has no time column, so time range limits don't apply.",
    ),
  ).not.toBeInTheDocument();
});

const DASHBOARD_HEADING =
  'These charts use their own time range, which this dashboard\'s limits don\'t allow. Viewers see "Waiting for a valid time range" on them until you change it.';
const DATASET_HEADING =
  "These charts on this dataset use their own time range, which these limits don't allow. Their queries stop until you change it.";
const NOT_CHECKED = 'Time range limits could not be checked for this chart.';
const CHECK_FAILED = 'Charts could not be checked against these limits.';
const UNBOUNDED =
  'This chart requires a bounded time range. Ask a dashboard editor to add or scope a time range filter.';

const refused = (
  id: number,
  name: string,
  range: string | null,
  rest: Partial<SaveCheckChart> = {},
): SaveCheckChart => ({
  id,
  slice_name: name,
  url: `/explore/?slice_id=${id}`,
  range,
  time_offset: null,
  reason_code: 'MAX_SPAN_EXCEEDED',
  rule: 'max_span',
  source: 'dashboard',
  message: "Range can't be longer than 90 days. This one is 366 days.",
  ...rest,
});

const CALLS = refused(1, 'Calls by queue', 'Last year');
const ABANDON = refused(2, 'Abandon trend', null, {
  reason_code: 'UNBOUNDED_RANGE',
  rule: null,
  source: null,
  message: UNBOUNDED,
});

const NINETY_DAYS = policy({ max_span: rule(90, 'P1D') });

const checked = (
  result: Partial<SaveCheckResult>,
  checkedPolicy: Policy | null = NINETY_DAYS,
  state: SaveCheck['state'] = 'done',
): SaveCheck => ({
  state,
  result: { charts: [], filters: [], unlimited: [], unchecked: [], ...result },
  checkedPolicy,
});

const warning = () =>
  screen
    .getAllByRole('alert')
    .find(alert => alert.className.includes('warning'))!;
const lineTexts = (alert: HTMLElement) =>
  // eslint-disable-next-line testing-library/no-node-access
  [
    ...alert.querySelectorAll(
      '.ant-alert-description .ant-typography:not(.ant-typography-link)',
    ),
  ]
    .slice(1)
    .map(line => line.textContent);

test('charts warning names the too-long charts in one sentence', () => {
  const global = policy({ max_span: rule(1, 'P1Y') });
  const { rerender } = render(
    <Harness
      global={global}
      stored={NINETY_DAYS}
      saveCheck={checked({ charts: [CALLS, ABANDON] })}
    />,
    { useRouter: true },
  );

  const alert = warning();
  expect(
    within(alert).getByText(
      'Calls by queue (Last year) and Abandon trend (No filter) use their own time range, longer than 90 days. Viewers see "Waiting for a valid time range" on them until you change it.',
    ),
  ).toBeInTheDocument();
  expect(lineTexts(alert)).toEqual([
    'Calls by queue (Last year)',
    'Abandon trend (No filter)',
  ]);
  const links = within(alert).getAllByRole('link');
  expect(links.map(link => link.textContent)).toEqual([
    'Calls by queue',
    'Abandon trend',
  ]);
  links.forEach((link, index) => {
    expect(link).toHaveAttribute('href', `/explore/?slice_id=${index + 1}`);
    expect(link).toHaveAttribute('target', '_blank');
  });

  // One chart: the singular form.
  rerender(
    <Harness
      global={global}
      stored={NINETY_DAYS}
      saveCheck={checked({ charts: [CALLS] })}
    />,
  );
  expect(
    within(warning()).getByText(
      'Calls by queue (Last year) uses its own time range, longer than 90 days. Viewers see "Waiting for a valid time range" on it until you change it.',
    ),
  ).toBeInTheDocument();

  // Look-back only: no span to name, so the generic heading.
  const lookBack = policy({ max_look_back: rule(6, 'P1M') });
  rerender(
    <Harness
      global={null}
      stored={lookBack}
      saveCheck={checked({ charts: [ABANDON] }, lookBack)}
    />,
  );
  expect(within(warning()).getByText(DASHBOARD_HEADING)).toBeInTheDocument();
  expect(screen.queryByText(/No limit\./)).not.toBeInTheDocument();
  expect(lineTexts(warning())).toEqual(['Abandon trend (No filter)']);
});

test('charts warning sentence forms', () => {
  const sentence = /use(s)? (its|their) own time range, longer than/;
  const cases: [
    string,
    Policy | null,
    Policy | null,
    SaveCheckChart[],
    boolean,
  ][] = [
    ['global only', policy({ max_span: rule(1, 'P1Y') }), null, [CALLS], true],
    [
      'both enforced',
      policy({ max_span: rule(3, 'P1M') }),
      NINETY_DAYS,
      [CALLS],
      false,
    ],
    [
      "a dataset's span",
      null,
      NINETY_DAYS,
      [refused(3, 'Agent load', 'Last year', { source: 'dataset' })],
      false,
    ],
    [
      'a look-back failure',
      null,
      NINETY_DAYS,
      [
        refused(4, 'Old calls', 'Last year', {
          reason_code: 'MAX_LOOK_BACK_EXCEEDED',
          rule: 'max_look_back',
        }),
      ],
      false,
    ],
    [
      'a comparison',
      null,
      NINETY_DAYS,
      [refused(5, 'Revenue', 'Last year', { time_offset: '1 year ago' })],
      false,
    ],
  ];
  cases.forEach(([name, global, checkedPolicy, charts, expectedHeading]) => {
    const { unmount } = render(
      <Harness
        global={global}
        stored={checkedPolicy ?? policy()}
        saveCheck={checked({ charts }, checkedPolicy)}
      />,
      { useRouter: true },
    );
    const heading = within(warning()).queryByText(sentence);
    expect([name, Boolean(heading)]).toEqual([name, expectedHeading]);
    unmount();
  });

  // The heading uses the policy the result was checked with, not the edited one.
  render(
    <Harness
      global={null}
      initial={toDraft(policy({ max_span: rule(120, 'P1D') }))}
      saveCheck={checked({ charts: [CALLS] }, NINETY_DAYS, 'checking')}
    />,
    { useRouter: true },
  );
  expect(
    within(warning()).getByText(/longer than 90 days\./),
  ).toBeInTheDocument();
});

test('mixed reasons list', () => {
  render(
    <Harness
      global={policy({ max_look_back: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={checked({
        charts: [
          refused(1, 'Old calls', 'Last 2 years', {
            reason_code: 'MAX_LOOK_BACK_EXCEEDED',
            rule: 'max_look_back',
            source: 'global',
            message: "Start can't be earlier than 1 year ago.",
          }),
          refused(2, 'Revenue', 'Last week', {
            time_offset: '1 year ago',
            message:
              'Time comparison "1 year ago": Start can\'t be earlier than 1 year ago.',
          }),
        ],
        filters: [
          {
            id: 'NATIVE_FILTER-1',
            name: 'Period',
            range: 'Last year',
            no_default: false,
            reason_code: 'MAX_SPAN_EXCEEDED',
            rule: 'max_span',
            source: 'dashboard',
            message:
              "Range can't be longer than 90 days. This one is 366 days.",
          },
          {
            id: 'NATIVE_FILTER-2',
            name: 'Any time',
            range: null,
            no_default: true,
            reason_code: null,
            rule: null,
            source: null,
            message: null,
          },
        ],
      })}
    />,
    { useRouter: true },
  );

  const alert = warning();
  expect(within(alert).getByText(DASHBOARD_HEADING)).toBeInTheDocument();
  expect(lineTexts(alert)).toEqual([
    'Time range filter "Period" defaults to Last year: Range can\'t be longer than 90 days. This one is 366 days.',
    'Time range filter "Any time" has no default range.',
    "Old calls (Last 2 years): Start can't be earlier than 1 year ago.",
    'Revenue: Time comparison "1 year ago": Start can\'t be earlier than 1 year ago.',
  ]);
  expect(
    within(alert)
      .getAllByRole('link')
      .map(link => link.textContent),
  ).toEqual(['Old calls', 'Revenue']);
  expect(alert).not.toHaveTextContent('Last week');
});

test('dataset list', () => {
  render(
    <Harness
      level="dataset"
      global={policy({ max_span: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={checked({
        charts: [CALLS],
        unlimited: [{ id: 9, slice_name: 'Map', url: '/explore/?slice_id=9' }],
      })}
    />,
    { useRouter: true },
  );

  const alert = warning();
  expect(within(alert).getByText(DATASET_HEADING)).toBeInTheDocument();
  expect(lineTexts(alert)).toEqual([
    "Calls by queue (Last year): Range can't be longer than 90 days. This one is 366 days.",
  ]);
  expect(screen.queryByText(/can't be limited/)).not.toBeInTheDocument();
});

test('cant be limited line', () => {
  const unlimited = ['Map', 'Queue list', 'Agent table'].map((name, index) => ({
    id: 10 + index,
    slice_name: name,
    url: `/explore/?slice_id=${10 + index}`,
  }));
  const { rerender } = render(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      saveCheck={checked({ unlimited: unlimited.slice(0, 1) }, null)}
    />,
    { useRouter: true },
  );
  expect(
    screen.getByText("Map can't be limited: its dataset has no time column."),
  ).toBeInTheDocument();
  expect(screen.queryAllByRole('alert')).toHaveLength(0);

  rerender(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      saveCheck={checked({ unlimited, charts: [CALLS] }, null)}
    />,
  );
  const three = screen.getByText(
    "Map, Queue list and Agent table can't be limited: their datasets have no time column.",
  );
  expect(warning()).not.toContainElement(three);

  // Past ten names: "… and 2 more".
  const twelve = Array.from({ length: 12 }, (_, index) => ({
    id: index,
    slice_name: `Chart ${index + 1}`,
    url: `/explore/?slice_id=${index}`,
  }));
  rerender(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      saveCheck={checked({ unlimited: twelve }, null)}
    />,
  );
  expect(
    screen.getByText(
      "Chart 1, Chart 2, Chart 3, Chart 4, Chart 5, Chart 6, Chart 7, Chart 8, Chart 9, Chart 10 and 2 more can't be limited: their datasets have no time column.",
    ),
  ).toBeInTheDocument();
});

test('unchecked line', () => {
  render(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      saveCheck={checked({
        unchecked: [
          { id: 8, slice_name: 'Pivot', url: '/explore/?slice_id=8' },
        ],
      })}
    />,
    { useRouter: true },
  );
  const alert = warning();
  expect(within(alert).getByText(DASHBOARD_HEADING)).toBeInTheDocument();
  expect(lineTexts(alert)).toEqual([`Pivot: ${NOT_CHECKED}`]);
  expect(within(alert).getByRole('link', { name: 'Pivot' })).toHaveAttribute(
    'href',
    '/explore/?slice_id=8',
  );
});

test('a truncated dataset check says only the first charts were checked, even with no failures', () => {
  render(<Harness level="dataset" saveCheck={checked({ truncated: true })} />, {
    useRouter: true,
  });
  expect(
    screen.getByText('Only the first 50 charts were checked.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/use their own time range|use its own time range/),
  ).not.toBeInTheDocument();
});

test('a complete save check adds no truncation note', () => {
  render(
    <Harness level="dataset" saveCheck={checked({ truncated: false })} />,
    { useRouter: true },
  );
  expect(screen.queryByText(/charts were checked/)).not.toBeInTheDocument();
});

test('caps the list', () => {
  const charts = Array.from({ length: 14 }, (_, index) =>
    refused(index + 1, `Chart ${index + 1}`, 'Last year'),
  );
  render(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={checked({ charts })}
    />,
    { useRouter: true },
  );
  const alert = warning();
  // More than ten lines: the generic heading, not fourteen names.
  expect(within(alert).getByText(DASHBOARD_HEADING)).toBeInTheDocument();
  const lines = lineTexts(alert);
  expect(lines).toHaveLength(11);
  expect(lines[9]).toMatch(/^Chart 10 \(Last year\): /);
  expect(lines[10]).toBe('and 4 more');
  expect(within(alert).getAllByRole('link')).toHaveLength(10);
});

test('hidden with field errors', async () => {
  const global = policy({ max_span: rule(12, 'P1W') });
  const { rerender } = render(
    <Harness
      global={global}
      initial={toDraft(policy({ max_span: rule(20, 'P1W') }))}
      saveCheck={checked({ charts: [CALLS] }, null)}
    />,
    { useRouter: true },
  );
  expect(
    screen.getByText("Can't be longer than the admin limit (12 weeks)"),
  ).toBeInTheDocument();
  expect(screen.queryByText(/own time range/)).not.toBeInTheDocument();

  await setQuantity('Longest range', '4');
  expect(warning()).toBeInTheDocument();

  // Idle: nothing.
  rerender(
    <Harness
      global={global}
      saveCheck={{ state: 'idle', result: null, checkedPolicy: null }}
    />,
  );
  expect(screen.queryAllByRole('alert')).toHaveLength(0);
  expect(screen.queryByText(CHECK_FAILED)).not.toBeInTheDocument();
});

const liveAncestors = (element: Element) => {
  const found: Element[] = [];
  // eslint-disable-next-line testing-library/no-node-access
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (
      node.hasAttribute('aria-live') ||
      node.getAttribute('role') === 'alert'
    ) {
      found.push(node);
    }
  }
  return found;
};

test('save check accessibility', () => {
  const global = policy({ max_span: rule(1, 'P1Y') });
  const map = { id: 9, slice_name: 'Map', url: '/explore/?slice_id=9' };
  const { rerender } = render(
    <Harness
      global={global}
      stored={NINETY_DAYS}
      saveCheck={{ state: 'checking', result: null, checkedPolicy: null }}
    />,
    { useRouter: true },
  );

  // Before the first result: the busy wrapper and its empty polite region.
  const region = screen.getByRole('region', { name: 'Time range limits' });
  expect(region).not.toHaveAttribute('aria-busy');
  // eslint-disable-next-line testing-library/no-node-access
  const wrapper = region.querySelector<HTMLElement>('[aria-busy="true"]')!;
  expect(wrapper).toBeInTheDocument();
  // eslint-disable-next-line testing-library/no-node-access
  const polite = wrapper.querySelector<HTMLElement>('[aria-live="polite"]')!;
  expect(polite).toBeEmptyDOMElement();
  expect(screen.queryAllByRole('alert')).toHaveLength(0);

  rerender(
    <Harness
      global={global}
      stored={NINETY_DAYS}
      saveCheck={checked({ charts: [CALLS, ABANDON], unlimited: [map] })}
    />,
  );
  expect(wrapper).not.toHaveAttribute('aria-busy');
  const alert = warning();
  expect(polite).not.toContainElement(alert);
  expect(alert).not.toContainElement(polite);
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  const unlimited = screen.getByText(
    "Map can't be limited: its dataset has no time column.",
  );
  expect(polite).toContainElement(unlimited);
  [
    within(alert).getByText(/use their own time range/),
    ...within(alert).getAllByRole('link'),
    unlimited,
  ].forEach(text => expect(liveAncestors(text)).toHaveLength(1));
  expect(
    within(alert)
      .getAllByRole('link')
      .map(link => link.textContent),
  ).toEqual(['Calls by queue', 'Abandon trend']);

  // The last result stays while checking again.
  rerender(
    <Harness
      global={global}
      stored={NINETY_DAYS}
      saveCheck={checked(
        { charts: [CALLS, ABANDON], unlimited: [map] },
        NINETY_DAYS,
        'checking',
      )}
    />,
  );
  expect(wrapper).toHaveAttribute('aria-busy', 'true');
  expect(warning()).toBeInTheDocument();

  // A failed check: the secondary line in the polite region, no Retry.
  rerender(
    <Harness
      global={global}
      stored={NINETY_DAYS}
      saveCheck={{ state: 'failed', result: null, checkedPolicy: NINETY_DAYS }}
    />,
  );
  const failed = screen.getByText(CHECK_FAILED);
  expect(polite).toContainElement(failed);
  expect(screen.queryAllByRole('alert')).toHaveLength(0);
  expect(
    screen.queryByRole('button', { name: 'Retry' }),
  ).not.toBeInTheDocument();
});

const expectHiddenIcon = (alert: HTMLElement) => {
  // eslint-disable-next-line testing-library/no-node-access
  const wrapper = alert.querySelector('.ant-alert-icon') as HTMLElement;
  // eslint-disable-next-line testing-library/no-node-access
  const icon = wrapper.querySelector('.anticon') as HTMLElement;
  expect(icon).toHaveAttribute('aria-hidden', 'true');
};

test('a11y: the section Alerts hide their icons', () => {
  const { rerender } = render(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={checked({ charts: [CALLS] })}
    />,
    { useRouter: true },
  );
  expectHiddenIcon(warning());

  rerender(
    <Harness
      state="failed"
      failure={{ attempt: 1, source: 'dashboard', unitValue: 'P1D' }}
      key="unit"
    />,
  );
  expectHiddenIcon(screen.getByRole('alert'));

  rerender(<Harness state="failed" failure={{ attempt: 2 }} key="failed" />);
  expectHiddenIcon(screen.getByRole('alert'));

  rerender(
    <Harness
      global={policy({ max_span: rule(30, 'P1D') })}
      stored={policy({ max_span: rule(2, 'P1M') })}
      needsReview={[{ rule: 'max_span', reason: 'LOOSER_THAN_GLOBAL' }]}
      key="stale"
    />,
  );
  expectHiddenIcon(screen.getByRole('alert'));

  rerender(<Harness saveFailed key="save" />);
  expectHiddenIcon(screen.getByRole('alert'));
});

test.each(['dashboard', 'dataset'] as const)(
  'the first load shows Loading in the region, %s level',
  level => {
    const { rerender } = render(
      <Harness level={level} state="loading" pending />,
    );

    const region = screen.getByRole('region', {
      name: 'Time range limits',
    });
    expect(within(region).getByRole('status')).toHaveAccessibleName('Loading');
    expect(quantity('Longest range')).toBeDisabled();

    rerender(<Harness level={level} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(
      <Harness level={level} state="failed" failure={{ attempt: 1 }} pending />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  },
);

test('field errors sit under the table, name their rule, in one live region', async () => {
  render(<Harness global={policy({ max_span: rule(12, 'P1W') })} />);

  const live = fieldErrorRegion();
  expect(live).toHaveAttribute('aria-live', 'polite');
  expect(live).toBeEmptyDOMElement();
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelectorAll('[aria-live]:not(.ant-spin)')).toHaveLength(
    1,
  );

  await setQuantity('Longest range', '13');
  await pickUnit('Longest range', 'Week');
  await setQuantity('Earliest start', '2');
  const spanError = await screen.findByText(
    "Can't be longer than the admin limit (12 weeks)",
  );
  const unitError = await screen.findByText('Select a unit.');

  screen.getAllByRole('table').forEach(table => {
    expect(within(table).queryByText(/Can't be longer than/)).toBeNull();
    expect(within(table).queryByText('Select a unit.')).toBeNull();
  });
  expect(live).toContainElement(spanError);
  expect(live).toContainElement(unitError);
  expect(spanError).toHaveAttribute(
    'id',
    'time-range-limits-max_span-quantity-error',
  );
  expect(unitError).toHaveAttribute(
    'id',
    'time-range-limits-max_look_back-time_grain-error',
  );
  expect(spanError).toHaveTextContent(
    /^Longest range Can't be longer than the admin limit \(12 weeks\)$/,
  );
  expect(unitError).toHaveTextContent(/^Earliest start Select a unit\.$/);
  expect(within(spanError).getByText('Longest range').tagName).toBe('STRONG');
  expect(quantity('Longest range')).toHaveAttribute(
    'aria-describedby',
    spanError.id,
  );
  expect(unit('Earliest start')).toHaveAttribute(
    'aria-describedby',
    unitError.id,
  );
});

test('a successful Retry focuses the region, a failed one the new Retry', async () => {
  const region = () =>
    screen.getByRole('region', { name: 'Time range limits' });
  const { rerender } = render(<Harness state="loading" pending />);
  rerender(<Harness />);
  expect(region()).toHaveAttribute('tabindex', '-1');
  expect(region()).not.toHaveFocus();

  rerender(<Harness state="failed" failure={{ attempt: 1 }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  rerender(<Harness state="failed" failure={{ attempt: 2 }} />);
  expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus();

  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  rerender(<Harness state="noUnits" />);
  expect(region()).toHaveFocus();

  // A later failure that no Retry asked for leaves focus where it is.
  region().blur();
  rerender(<Harness state="failed" failure={{ attempt: 3 }} />);
  expect(screen.getByRole('button', { name: 'Retry' })).not.toHaveFocus();
  rerender(<Harness />);
  expect(region()).not.toHaveFocus();
});

test('after a failed Retry, a later load leaves the region unfocused', async () => {
  const region = () =>
    screen.getByRole('region', { name: 'Time range limits' });
  const { rerender } = render(
    <Harness state="failed" failure={{ attempt: 1 }} />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  rerender(<Harness state="failed" failure={{ attempt: 2 }} />);
  expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus();

  rerender(<Harness />);
  expect(region()).not.toHaveFocus();
});

test('the unit list opens outside the table cell', async () => {
  render(<Harness />);

  await userEvent.click(unit('Longest range'));
  const list = await waitFor(() => {
    // eslint-disable-next-line testing-library/no-node-access
    const found = document.querySelector<HTMLElement>('.ant-select-dropdown');
    expect(found).not.toBeNull();
    return found!;
  });
  // eslint-disable-next-line testing-library/no-node-access
  expect(list.closest('table')).toBeNull();
  expect(within(list).getByText('Week')).toBeInTheDocument();
});

test('the Rule column has a description under each label; Effective stays plain text', () => {
  render(
    <Harness
      global={policy({
        max_span: rule(1, 'P1Y'),
        max_look_back: rule(2, 'P1Y'),
        max_look_forward: rule(1, 'P1W'),
      })}
    />,
  );

  [
    ['Longest range', 'Start-to-end duration.'],
    ['Earliest start', 'Earliest start from now.'],
    ['Latest end', 'Latest end from now.'],
  ].forEach(([label, description]) => {
    const [ruleCell] = cells(new RegExp(label));
    expect(within(ruleCell).getByText(label)).toBeInTheDocument();
    expect(within(ruleCell).getByText(description)).toBeInTheDocument();
  });
  expect(cells(/Earliest start/)[3]).toHaveTextContent(/^2 years ago$/);
});

test('values read as "… ago", "… from now", "Today"', () => {
  const { rerender } = render(
    <Harness
      global={policy({
        max_span: rule(1, 'P1Y'),
        max_look_back: rule(2, 'P1Y'),
        max_look_forward: rule(1, 'P1W'),
      })}
    />,
  );
  expect(cells(/Longest range/)[1]).toHaveTextContent(/^1 year$/);
  expect(cells(/Earliest start/)[1]).toHaveTextContent(/^2 years ago$/);
  expect(cells(/Latest end/)[1]).toHaveTextContent(/^1 week from now$/);
  expect(cells(/Latest end/)[3]).toHaveTextContent(/^1 week from now$/);

  rerender(
    <Harness
      global={policy({
        max_look_back: rule(0, 'P1D'),
        max_look_forward: rule(0, 'P1D'),
      })}
      key="zero"
    />,
  );
  expect(cells(/Earliest start/)[1]).toHaveTextContent(/^Today$/);
  expect(cells(/Latest end/)[1]).toHaveTextContent(/^Today$/);
  expect(cells(/Longest range/)[1]).toHaveTextContent(/^No limit$/);
});

test('"ago" sits on its own line under the Earliest start unit only', () => {
  render(<Harness />);

  const ago = within(cells(/Earliest start/)[2]).getByText('ago');
  expect(ago).toBeInTheDocument();
  expect(within(cells(/Longest range/)[2]).queryByText('ago')).toBeNull();
  expect(within(cells(/Latest end/)[2]).queryByText('ago')).toBeNull();
});

test('a custom range with two dates reads as the actual range; other ranges stay as stored', () => {
  render(
    <Harness
      global={policy({ max_look_back: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={checked({
        charts: [
          refused(1, 'Custom', '2003-01-01T00:00:00 : 2005-06-01T00:00:00', {
            reason_code: 'MAX_LOOK_BACK_EXCEEDED',
            rule: 'max_look_back',
            message: 'REASON',
          }),
          refused(
            2,
            'Advanced',
            'DATEADD(DATETIME("today"), -7, day) : today',
            {
              reason_code: 'MAX_LOOK_BACK_EXCEEDED',
              rule: 'max_look_back',
              message: 'REASON',
            },
          ),
          refused(3, 'Sales', 'Last year', { message: 'REASON' }),
        ],
        filters: [
          {
            id: 'NATIVE_FILTER-1',
            name: 'Period',
            range: '2003-01-01 : 2004-01-01',
            no_default: false,
            reason_code: 'MAX_LOOK_BACK_EXCEEDED',
            rule: 'max_look_back',
            source: 'global',
            message: 'REASON',
          },
        ],
      })}
    />,
    { useRouter: true },
  );

  expect(lineTexts(warning())).toEqual([
    'Time range filter "Period" defaults to 2003-01-01 ≤ col < 2004-01-01: REASON',
    'Custom (2003-01-01 ≤ col < 2005-06-01): REASON',
    'Advanced (DATEADD(DATETIME("today"), -7, day) : today): REASON',
    'Sales (Last year): REASON',
  ]);
});

test('an unbounded chart line has no reason; others keep theirs', () => {
  render(
    <Harness
      global={policy({ max_look_back: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={checked({
        charts: [
          ABANDON,
          refused(3, 'Old calls', 'Last 2 years', {
            reason_code: 'MAX_LOOK_BACK_EXCEEDED',
            rule: 'max_look_back',
            message: "Start can't be earlier than 1 year ago.",
          }),
        ],
      })}
    />,
    { useRouter: true },
  );

  expect(lineTexts(warning())).toEqual([
    'Abandon trend (No filter)',
    "Old calls (Last 2 years): Start can't be earlier than 1 year ago.",
  ]);
});

test('the warning Alert explains the affected charts', () => {
  render(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={checked({ charts: [CALLS, ABANDON] })}
    />,
    { useRouter: true },
  );

  const alert = warning();
  expect(
    within(alert).getByText(/use their own time range, longer than 90 days/),
  ).toBeInTheDocument();
  expect(
    within(alert).getByRole('link', { name: 'Calls by queue' }),
  ).toBeInTheDocument();
  expect(
    within(alert).getByRole('link', { name: 'Abandon trend' }),
  ).toBeInTheDocument();
});

const PAGE_LINK_CHECK = checked({
  charts: [refused(1, 'Calls by queue', 'Last year', { message: 'REASON' })],
  unchecked: [{ id: 5, slice_name: 'Map', url: '/explore/?slice_id=5' }],
});

const linkHrefs = () =>
  within(warning())
    .getAllByRole('link')
    .map(link => link.getAttribute('href'));

test('on a dashboard page the chart links open Explore under that dashboard', () => {
  render(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={PAGE_LINK_CHECK}
      dashboardPageId="PAGE-1"
    />,
    { useRouter: true },
  );

  expect(linkHrefs()).toEqual([
    '/explore/?dashboard_page_id=PAGE-1&slice_id=1',
    '/explore/?dashboard_page_id=PAGE-1&slice_id=5',
  ]);
});

test('without a dashboard page, or on a dataset, the links keep the chart URL', () => {
  const { unmount } = render(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={PAGE_LINK_CHECK}
      dashboardPageId=""
    />,
    { useRouter: true },
  );
  expect(linkHrefs()).toEqual(['/explore/?slice_id=1', '/explore/?slice_id=5']);
  unmount();

  render(
    <Harness
      level="dataset"
      global={policy({ max_span: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={PAGE_LINK_CHECK}
      dashboardPageId="PAGE-1"
    />,
    { useRouter: true },
  );
  expect(linkHrefs()).toEqual(['/explore/?slice_id=1', '/explore/?slice_id=5']);
});

test('a custom range with one date and an open end reads as the actual range', () => {
  render(
    <Harness
      global={policy({ max_look_back: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={checked({
        charts: [
          refused(1, 'From', '2003-01-01 : ', {
            reason_code: 'MAX_LOOK_BACK_EXCEEDED',
            rule: 'max_look_back',
            message: 'REASON',
          }),
          refused(2, 'Until', ' : 2005-06-01', {
            reason_code: 'MAX_LOOK_BACK_EXCEEDED',
            rule: 'max_look_back',
            message: 'REASON',
          }),
          refused(3, 'Open', ' : ', {
            reason_code: 'MAX_LOOK_BACK_EXCEEDED',
            rule: 'max_look_back',
            message: 'REASON',
          }),
        ],
      })}
    />,
    { useRouter: true },
  );

  expect(lineTexts(warning())).toEqual([
    'From (2003-01-01 ≤ col < ∞): REASON',
    'Until (-∞ ≤ col < 2005-06-01): REASON',
    'Open ( : ): REASON',
  ]);
});

test('a result with filter defaults only uses the generic heading', () => {
  render(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={checked({
        filters: [
          {
            id: 'NATIVE_FILTER-1',
            name: 'Period',
            range: 'Last year',
            no_default: false,
            reason_code: 'MAX_SPAN_EXCEEDED',
            rule: 'max_span',
            source: 'dashboard',
            message:
              "Range can't be longer than 90 days. This one is 366 days.",
          },
        ],
      })}
    />,
    { useRouter: true },
  );

  expect(warning()).not.toHaveTextContent('longer than 90 days. Viewers see');
  expect(warning()).toHaveTextContent('Period');
});

test('an idle save check adds no busy wrapper and no extra live region', () => {
  render(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      saveCheck={{ state: 'idle', result: null, checkedPolicy: null }}
    />,
    { useRouter: true },
  );

  const region = screen.getByRole('region', { name: 'Time range limits' });
  // eslint-disable-next-line testing-library/no-node-access
  expect(region.querySelectorAll('[aria-live]:not(.ant-spin)')).toHaveLength(1);
  // eslint-disable-next-line testing-library/no-node-access
  expect(region.querySelectorAll('[aria-busy]:not(.ant-spin)')).toHaveLength(0);
});

test('the chart links are antd links that open in a new tab', () => {
  render(
    <Harness
      global={policy({ max_span: rule(1, 'P1Y') })}
      stored={NINETY_DAYS}
      saveCheck={PAGE_LINK_CHECK}
    />,
    { useRouter: true },
  );

  const links = within(warning()).getAllByRole('link');
  expect(links).toHaveLength(2);
  links.forEach(link => {
    expect(link).toHaveAttribute('target', '_blank');
  });
});

test('an unavailable dataset policy does not prevent editing dashboard limits', () => {
  render(
    <Harness
      onChange={jest.fn()}
      datasets={[
        {
          id: 7,
          name: 'Unavailable',
          policy: null,
          error: {
            message: 'Policy unavailable',
            error_type: 'TIME_RANGE_LIMIT_ERROR',
          },
        },
      ]}
    />,
  );
  expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
});
