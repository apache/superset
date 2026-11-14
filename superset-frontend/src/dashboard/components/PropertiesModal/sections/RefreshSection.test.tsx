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
import { useEffect, useState } from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { useRefreshPolicy } from '../hooks/useRefreshPolicy';
import RefreshSection from './RefreshSection';

const DEFAULT_LIST = [
  [0, "Don't refresh"],
  [10, '10 seconds'],
  [30, '30 seconds'],
  [60, '1 minute'],
  [300, '5 minutes'],
  [1800, '30 minutes'],
  [3600, '1 hour'],
  [21600, '6 hours'],
  [43200, '12 hours'],
  [86400, '24 hours'],
];

const minutes = (value: number) => ({ value, unit: 'minutes' });
const hours = (value: number) => ({ value, unit: 'hours' });

const Harness = ({
  metadata,
  serverErrors,
  edited,
}: {
  metadata: Record<string, unknown>;
  serverErrors?: Record<string, string>;
  edited: boolean;
}) => {
  const [refreshFrequency, setRefreshFrequency] = useState(
    (metadata.refresh_frequency as number) ?? 0,
  );
  const refreshPolicy = useRefreshPolicy({
    refreshFrequency,
    setRefreshFrequency,
  });
  const { load, setServerErrors } = refreshPolicy;
  useEffect(() => {
    load(edited ? { refresh_frequency: 0 } : metadata);
    if (edited) refreshPolicy.setFromJson(metadata);
    if (serverErrors) {
      setServerErrors(serverErrors);
    }
  }, [load, metadata, serverErrors, setServerErrors, edited]);
  return (
    <RefreshSection
      refreshFrequency={refreshFrequency}
      onRefreshFrequencyChange={refreshPolicy.setFrequency}
      policy={refreshPolicy.policy}
      errors={refreshPolicy.errors}
      adminList={refreshPolicy.adminList}
      onPolicyOnChange={refreshPolicy.setPolicyOn}
      onAllowedChange={refreshPolicy.setAllowed}
      onBoundChange={refreshPolicy.setBound}
      {...refreshPolicy.refs}
    />
  );
};

const setup = (
  metadata: Record<string, unknown>,
  serverErrors?: Record<string, string>,
  edited = false,
) =>
  render(
    <Harness metadata={metadata} serverErrors={serverErrors} edited={edited} />,
    {
      useRedux: true,
      initialState: {
        common: { conf: { DASHBOARD_AUTO_REFRESH_INTERVALS: DEFAULT_LIST } },
      },
    },
  );

const setupEdited = (
  metadata: Record<string, unknown>,
  serverErrors?: Record<string, string>,
) => setup(metadata, serverErrors, true);

const selectValue = (name: string) =>
  screen
    .getByRole('combobox', { name })
    .closest('.ant-select')
    ?.querySelector('.ant-select-content[title]')?.textContent ?? null;

// Each Select renders its dropdown on first open; ids are not unique in
// tests, so the dropdown is found as the one that appeared after the click.
const openDropdown = async (name: string) => {
  const before = new Set(document.querySelectorAll('.ant-select-dropdown'));
  await userEvent.click(screen.getByRole('combobox', { name }));
  return waitFor(() => {
    const dropdown = Array.from(
      document.querySelectorAll<HTMLElement>('.ant-select-dropdown'),
    ).find(element => !before.has(element));
    expect(dropdown).toBeTruthy();
    return dropdown!;
  });
};

const openOptions = async (name: string) =>
  Array.from(
    (await openDropdown(name)).querySelectorAll(
      '.ant-select-item-option-content',
    ),
  ).map(option => option.textContent);

const pickOption = async (name: string, label: string) => {
  await userEvent.click(within(await openDropdown(name)).getByTitle(label));
  await waitFor(() => expect(selectValue(name)).toBe(label));
};

const radioLabels = (groupName: string) =>
  within(screen.getByRole('radiogroup', { name: groupName }))
    .getAllByRole('radio')
    .map(radio => radio.closest('label')?.textContent);

test('policy off shows the existing Refresh frequency select with Custom', async () => {
  setup({ refresh_frequency: 45 });
  const policySwitch = await screen.findByRole('switch', {
    name: 'Use a refresh policy',
  });
  expect(policySwitch).not.toBeChecked();
  expect(
    screen.getByText(
      'Without a policy, viewers can pick any interval, including Custom.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByText('Refresh frequency')).toBeInTheDocument();
  expect(radioLabels('Refresh frequency')).toContain('Customseconds');
  expect(screen.getByRole('spinbutton')).toHaveValue(45);
  expect(
    screen.queryByRole('switch', { name: 'Allow auto-refresh' }),
  ).not.toBeInTheDocument();
});

test('policy off shows a server refresh_frequency error under the existing select', async () => {
  setup(
    { refresh_frequency: 45 },
    {
      refresh_frequency:
        'Refresh frequency must be one of the standard intervals.',
    },
  );
  const error = await screen.findByText(
    'Refresh frequency must be one of the standard intervals.',
  );
  expect(
    screen.getByRole('radiogroup', { name: 'Refresh frequency' }),
  ).toHaveAttribute('aria-describedby', error.id);
});

test('turning the policy on shows Allow, Shortest, Longest and Default', async () => {
  setup({ refresh_frequency: 0 });
  await userEvent.click(
    await screen.findByRole('switch', { name: 'Use a refresh policy' }),
  );
  expect(
    await screen.findByRole('switch', { name: 'Allow auto-refresh' }),
  ).toBeChecked();
  expect(selectValue('Shortest interval')).toBe('No limit');
  expect(selectValue('Longest interval')).toBe('No limit');
  expect(screen.getByText('Default refresh frequency')).toBeInTheDocument();
  expect(
    screen.getByText(
      'Only intervals between the shortest and longest are offered.',
    ),
  ).toBeInTheDocument();
  expect(radioLabels('Default refresh frequency')).not.toContain(
    'Customseconds',
  );
});

test('Allow off with no default disables the bounds, explains retained settings and hides Default', async () => {
  setup({
    refresh_frequency: 0,
    auto_refresh_policy: {
      auto_refresh_allowed: true,
      minimum_refresh_interval: minutes(1),
      maximum_refresh_interval: hours(1),
    },
  });
  await userEvent.click(
    await screen.findByRole('switch', { name: 'Allow auto-refresh' }),
  );
  expect(
    await screen.findByText(
      "Viewers can't turn on auto-refresh for this dashboard, including embedded users.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'These settings are kept and checked again when you turn auto-refresh back on.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: 'Shortest interval' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('combobox', { name: 'Longest interval' }),
  ).toBeDisabled();
  expect(selectValue('Shortest interval')).toBe('1 minute');
  expect(selectValue('Longest interval')).toBe('1 hour');
  expect(
    screen.queryByRole('radiogroup', { name: 'Default refresh frequency' }),
  ).not.toBeInTheDocument();
});

// The shared Select lists the selected option first (existing behaviour); the
// others keep the admin list order.
test('Shortest and Longest limit each other and keep the admin list order', async () => {
  setup({
    refresh_frequency: 0,
    auto_refresh_policy: {
      minimum_refresh_interval: minutes(5),
      maximum_refresh_interval: hours(6),
    },
  });
  await screen.findByRole('switch', { name: 'Allow auto-refresh' });
  expect(await openOptions('Shortest interval')).toEqual([
    '5 minutes',
    'No limit',
    '10 seconds',
    '30 seconds',
    '1 minute',
    '30 minutes',
    '1 hour',
    '6 hours',
  ]);
  expect(await openOptions('Longest interval')).toEqual([
    '6 hours',
    'No limit',
    '5 minutes',
    '30 minutes',
    '1 hour',
    '12 hours',
    '24 hours',
  ]);
});

test('a hand-edited min > max shows both labels and the error on both', async () => {
  setupEdited({
    refresh_frequency: 0,
    auto_refresh_policy: {
      minimum_refresh_interval: hours(1),
      maximum_refresh_interval: minutes(5),
    },
  });
  await screen.findByRole('switch', { name: 'Allow auto-refresh' });
  expect(selectValue('Shortest interval')).toBe('1 hour');
  expect(selectValue('Longest interval')).toBe('5 minutes');
  expect(
    screen.getAllByText(
      'Shortest interval must be shorter than or equal to the longest interval.',
    ),
  ).toHaveLength(2);
});

test('a stale bound is offered with its label and the explanatory note, also while Allow is off', async () => {
  setup({
    refresh_frequency: 0,
    auto_refresh_policy: {
      auto_refresh_allowed: true,
      minimum_refresh_interval: { value: 45, unit: 'seconds' },
    },
  });
  await screen.findByRole('switch', { name: 'Allow auto-refresh' });
  const note =
    "45 seconds is no longer in the admin's list. Viewers get the intervals inside it.";
  expect(selectValue('Shortest interval')).toBe('45 seconds');
  expect(screen.getByText(note)).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('switch', { name: 'Allow auto-refresh' }),
  );
  await screen.findByText(
    'These settings are kept and checked again when you turn auto-refresh back on.',
  );
  expect(screen.getByText(note)).toBeInTheDocument();
  expect(selectValue('Shortest interval')).toBe('45 seconds');
});

test('the standard boundary error replaces the stale note once the policy changed', async () => {
  setup({
    refresh_frequency: 0,
    auto_refresh_policy: {
      minimum_refresh_interval: { value: 45, unit: 'seconds' },
    },
  });
  await screen.findByRole('switch', { name: 'Allow auto-refresh' });
  expect(
    screen.getByText(
      "45 seconds is no longer in the admin's list. Viewers get the intervals inside it.",
    ),
  ).toBeInTheDocument();
  await pickOption('Longest interval', '1 hour');
  expect(
    await screen.findByText(
      "45 seconds isn't a standard interval. Select one from the list.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(
      "45 seconds is no longer in the admin's list. Viewers get the intervals inside it.",
    ),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: 'Shortest interval' }),
  ).toHaveAttribute('aria-invalid', 'true');
});

test.each([['x'], [[]]])(
  'policy state %j: Allow unchecked and disabled, bounds disabled with no value, no Default',
  async policy => {
    setup({ refresh_frequency: 0, auto_refresh_policy: policy });
    const allow = await screen.findByRole('switch', {
      name: 'Allow auto-refresh',
    });
    expect(allow).not.toBeChecked();
    expect(allow).toBeDisabled();
    expect(
      screen.queryByText(
        "Viewers can't turn on auto-refresh for this dashboard, including embedded users.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'These settings are kept and checked again when you turn auto-refresh back on.',
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Shortest interval' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Longest interval' }),
    ).toBeDisabled();
    expect(selectValue('Shortest interval')).toBeNull();
    expect(selectValue('Longest interval')).toBeNull();
    expect(
      screen.queryByRole('radiogroup', { name: 'Default refresh frequency' }),
    ).not.toBeInTheDocument();
  },
);

test("prohibited with a saved 300 shows the error on Default, offering only Don't refresh", async () => {
  setupEdited({
    refresh_frequency: 300,
    auto_refresh_policy: { auto_refresh_allowed: false },
  });
  const allow = await screen.findByRole('switch', {
    name: 'Allow auto-refresh',
  });
  const error = screen.getByText(
    'A default of 5 minutes is set, but auto-refresh is off. Pick "Don\'t refresh".',
  );
  const group = screen.getByRole('radiogroup', {
    name: 'Default refresh frequency',
  });
  expect(group).toHaveAttribute('aria-describedby', error.id);
  expect(group).toHaveAttribute('aria-invalid', 'true');
  expect(error.closest('[role="alert"]')).toBeInTheDocument();
  expect(radioLabels('Default refresh frequency')).toEqual(["Don't refresh"]);
  expect(within(group).queryByRole('radio', { checked: true })).toBeNull();
  expect(allow).not.toHaveAttribute('aria-invalid');
  expect(allow).not.toHaveAttribute('aria-describedby');
});

test('Allow off keeps a positive default and shows its error on Default', async () => {
  setup({
    refresh_frequency: 300,
    auto_refresh_policy: { auto_refresh_allowed: true },
  });
  await userEvent.click(
    await screen.findByRole('switch', { name: 'Allow auto-refresh' }),
  );
  const error = await screen.findByText(
    'A default of 5 minutes is set, but auto-refresh is off. Pick "Don\'t refresh".',
  );
  expect(
    screen.getByRole('radiogroup', { name: 'Default refresh frequency' }),
  ).toHaveAttribute('aria-describedby', error.id);
});

test("picking Don't refresh while prohibited clears the error and keeps Default and focus", async () => {
  setupEdited({
    refresh_frequency: 300,
    auto_refresh_policy: { auto_refresh_allowed: false },
  });
  const error =
    'A default of 5 minutes is set, but auto-refresh is off. Pick "Don\'t refresh".';
  await screen.findByText(error);
  const dontRefresh = screen.getByRole('radio', { name: "Don't refresh" });
  await userEvent.click(dontRefresh);

  await waitFor(() =>
    expect(screen.queryByText(error)).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('radio', { name: "Don't refresh" })).toBeChecked();
  expect(screen.getByRole('radio', { name: "Don't refresh" })).toHaveFocus();
  expect(
    screen.getByRole('radiogroup', { name: 'Default refresh frequency' }),
  ).not.toHaveAttribute('aria-describedby');
});

test('a malformed bound selects nothing and shows the invalid boundary error', async () => {
  setupEdited({
    refresh_frequency: 0,
    auto_refresh_policy: {
      maximum_refresh_interval: { value: 2, unit: 'days' },
    },
  });
  await screen.findByRole('switch', { name: 'Allow auto-refresh' });
  expect(selectValue('Longest interval')).toBeNull();
  const error = screen.getByText(
    'Use a whole number of seconds, minutes or hours.',
  );
  const longest = screen.getByRole('combobox', { name: 'Longest interval' });
  expect(longest).toHaveAttribute('aria-invalid', 'true');
  expect(longest).toHaveAttribute('aria-describedby', error.id);
});

test('Default follows the bounds live and never offers Custom', async () => {
  setup({ refresh_frequency: 0, auto_refresh_policy: {} });
  await screen.findByRole('switch', { name: 'Allow auto-refresh' });
  expect(radioLabels('Default refresh frequency')).toHaveLength(10);
  await pickOption('Shortest interval', '5 minutes');
  await pickOption('Longest interval', '1 hour');
  expect(radioLabels('Default refresh frequency')).toEqual([
    "Don't refresh",
    '5 minutes',
    '30 minutes',
    '1 hour',
  ]);
});

test('a default below the shortest shows an error when auto-refresh is re-enabled', async () => {
  setupEdited({
    refresh_frequency: 60,
    auto_refresh_policy: { minimum_refresh_interval: minutes(5) },
  });
  const error = await screen.findByText(
    'The saved default (1 minute) is shorter than the shortest interval. Pick another.',
  );
  const group = screen.getByRole('radiogroup', {
    name: 'Default refresh frequency',
  });
  expect(group).toHaveAttribute('aria-describedby', error.id);
  expect(group).toHaveAttribute('aria-invalid', 'true');
  expect(within(group).queryByRole('radio', { checked: true })).toBeNull();
});

test('a default above the longest shows its error', async () => {
  setupEdited({
    refresh_frequency: 3600,
    auto_refresh_policy: { maximum_refresh_interval: minutes(5) },
  });
  expect(
    await screen.findByText(
      'The saved default (1 hour) is longer than the longest interval. Pick another.',
    ),
  ).toBeInTheDocument();
});

test('a custom default shows the standard-interval error', async () => {
  setupEdited({ refresh_frequency: 45, auto_refresh_policy: {} });
  expect(
    await screen.findByText(
      "The saved default (45 seconds) isn't one of the standard intervals. Pick another.",
    ),
  ).toBeInTheDocument();
});

test('the Selects and switches carry aria-invalid and aria-describedby only with an error', async () => {
  setupEdited({
    refresh_frequency: 0,
    auto_refresh_policy: {
      auto_refresh_allowed: 'yes',
      minimum_refresh_interval: hours(1),
      maximum_refresh_interval: minutes(5),
    },
  });
  const allow = await screen.findByRole('switch', {
    name: 'Allow auto-refresh',
  });
  expect(allow).toHaveAttribute('aria-invalid', 'true');
  expect(allow).toHaveAttribute(
    'aria-describedby',
    screen.getByText('Must be true or false.').id,
  );
  const shortest = screen.getByRole('combobox', { name: 'Shortest interval' });
  expect(shortest).toHaveAttribute('aria-invalid', 'true');
  expect(shortest.getAttribute('aria-describedby')).toBeTruthy();
  expect(
    screen.getByRole('switch', { name: 'Use a refresh policy' }),
  ).not.toHaveAttribute('aria-invalid');
});

test('valid controls have no aria-invalid, and the alert regions exist before any error', async () => {
  const { container } = setup({
    refresh_frequency: 300,
    auto_refresh_policy: { minimum_refresh_interval: minutes(1) },
  });
  const allow = await screen.findByRole('switch', {
    name: 'Allow auto-refresh',
  });
  expect(allow).not.toHaveAttribute('aria-invalid');
  expect(
    screen.getByRole('combobox', { name: 'Shortest interval' }),
  ).not.toHaveAttribute('aria-invalid');
  const group = screen.getByRole('radiogroup', {
    name: 'Default refresh frequency',
  });
  expect(group).not.toHaveAttribute('aria-describedby');
  expect(group).not.toHaveAttribute('aria-invalid');
  const regions = container.querySelectorAll('[role="alert"]');
  expect(regions).toHaveLength(4);
  regions.forEach(region => expect(region).toBeEmptyDOMElement());
});
