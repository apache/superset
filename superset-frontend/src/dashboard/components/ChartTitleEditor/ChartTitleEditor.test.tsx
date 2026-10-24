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
import { ComponentProps } from 'react';
import { NativeFilterType } from '@superset-ui/core';
import mockState from 'spec/fixtures/mockState';
import { createSelectNativeFilter } from 'spec/fixtures/mockNativeFilters';
import {
  render,
  screen,
  userEvent,
  fireEvent,
  selectOption,
  waitFor,
} from 'spec/helpers/testing-library';
import ChartTitleEditor from '.';
import UndoRedoKeyListeners from '../UndoRedoKeyListeners';

const chartId = 18;
const filter = createSelectNativeFilter('country-filter', 'Country');
const initialState = {
  ...mockState,
  dashboardLayout: {
    past: [],
    future: [],
    present: {
      CHART: {
        id: 'CHART',
        type: 'CHART',
        parents: ['ROOT_ID'],
        children: [],
        meta: { chartId },
      },
    },
  },
  dashboardInfo: {
    ...mockState.dashboardInfo,
    metadata: {
      native_filter_configuration: [
        filter,
        {
          ...filter,
          id: 'excluded',
          name: 'Excluded',
          scope: { rootPath: ['ROOT_ID'], excluded: [chartId] },
        },
        { id: 'divider', title: 'Section', type: NativeFilterType.Divider },
      ],
    },
  },
  dataMask: {
    [filter.id]: {
      id: filter.id,
      filterState: { value: ['Brazil'] },
      extraFormData: {},
    },
  },
};

function renderEditor(
  props: Partial<ComponentProps<typeof ChartTitleEditor>> = {},
) {
  const onApply = jest.fn();
  const onHide = jest.fn();
  const onUndo = jest.fn();
  const onRedo = jest.fn();
  render(
    <>
      <UndoRedoKeyListeners onUndo={onUndo} onRedo={onRedo} />
      <ChartTitleEditor
        chartId={chartId}
        baseTitle="Revenue"
        originalTitle="Revenue"
        onApply={onApply}
        onHide={onHide}
        {...props}
      />
    </>,
    { useRedux: true, initialState },
  );
  return { onApply, onHide, onUndo, onRedo };
}

test.each([
  { key: 'z', code: 'KeyZ', ctrlKey: true },
  { key: 'y', code: 'KeyY', ctrlKey: true },
  { key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true },
  { key: 'z', code: 'KeyZ', metaKey: true },
  { key: 'z', code: 'KeyZ', metaKey: true, shiftKey: true },
  { key: 'я', code: 'KeyZ', ctrlKey: true },
])('keeps text history inside the draft for shortcut %p', async shortcut => {
  const { onUndo, onRedo, onApply, onHide } = renderEditor({
    config: { template: '{{chart_title}}', tokenMappings: {} },
  });
  for (const control of [
    screen.getByLabelText('Base title'),
    screen.getByLabelText('Title template'),
    screen.getByRole('button', { name: 'Cancel' }),
    screen.getByRole('button', { name: 'Apply' }),
  ]) {
    const event = new KeyboardEvent('keydown', {
      ...shortcut,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(control, event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(onUndo).not.toHaveBeenCalled();
  expect(onRedo).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onApply).not.toHaveBeenCalled();
  expect(onHide).toHaveBeenCalledTimes(1);
});

test('inserts scoped tokens with a preview and applies only used mappings', async () => {
  const { onApply } = renderEditor();
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Use a dynamic title' }),
  );
  await selectOption('Base chart title', 'Insert token');
  await selectOption('Country', 'Insert token');
  expect(screen.getByLabelText('Title template')).toHaveValue(
    '{{chart_title}} {{country}}',
  );
  expect(screen.getByTestId('dynamic-title-preview')).toHaveTextContent(
    'Revenue Brazil',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith('Revenue', {
    template: '{{chart_title}} {{country}}',
    tokenMappings: { country: filter.id },
  });
});

test('cancel discards the entire draft', async () => {
  const { onApply, onHide } = renderEditor();
  fireEvent.change(screen.getByLabelText('Base title'), {
    target: { value: 'Changed' },
  });
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Use a dynamic title' }),
  );
  fireEvent.change(screen.getByLabelText('Title template'), {
    target: { value: 'Changed {{unknown}}' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onApply).not.toHaveBeenCalled();
  expect(onHide).toHaveBeenCalledTimes(1);
});

test.each([true, false])(
  'clearing an override previews the original chart title (dynamic: %p)',
  async enabled => {
    const { onApply } = renderEditor({
      baseTitle: 'Custom revenue',
      originalTitle: 'Original revenue',
      config: enabled
        ? {
            template: '{{chart_title}} in {{country}}',
            tokenMappings: { country: filter.id },
          }
        : undefined,
    });
    fireEvent.change(screen.getByLabelText('Base title'), {
      target: { value: '' },
    });
    expect(screen.getByTestId('dynamic-title-preview')).toHaveTextContent(
      enabled ? 'Original revenue in Brazil' : 'Original revenue',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(
      '',
      enabled
        ? {
            template: '{{chart_title}} in {{country}}',
            tokenMappings: { country: filter.id },
          }
        : undefined,
    );
  },
);

test('can insert the same token repeatedly without creating a second alias', async () => {
  const { onApply } = renderEditor();
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Use a dynamic title' }),
  );
  await selectOption('Country', 'Insert token');
  await selectOption('Country', 'Insert token');
  expect(screen.getByLabelText('Title template')).toHaveValue(
    '{{country}} {{country}}',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith('Revenue', {
    template: '{{country}} {{country}}',
    tokenMappings: { country: filter.id },
  });
});

test.each(['', '{{country', '{{unknown}}'])(
  'rejects invalid template %p without applying',
  async template => {
    const { onApply } = renderEditor();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Use a dynamic title' }),
    );
    fireEvent.change(screen.getByLabelText('Title template'), {
      target: { value: template },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByTestId('dynamic-title-preview')).toHaveTextContent(
      'Revenue',
    );
  },
);

test('allows disabling an invalid saved template without changing the base title', async () => {
  const { onApply } = renderEditor({
    config: {
      template: '{{removed}}',
      tokenMappings: { removed: 'removed-filter' },
    },
  });
  await waitFor(() =>
    expect(
      screen.getByText('Update or remove invalid tokens: removed'),
    ).toBeVisible(),
  );
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Use a dynamic title' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith('Revenue', undefined);
});

test('removes stale unused mappings when applying an edited template', async () => {
  const { onApply } = renderEditor({
    config: {
      template: '{{chart_title}}',
      tokenMappings: { old: 'removed-filter' },
    },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onApply).toHaveBeenCalledWith('Revenue', {
    template: '{{chart_title}}',
    tokenMappings: {},
  });
});

test('offers only filters currently affecting the chart', async () => {
  renderEditor({ config: { template: '{{chart_title}}', tokenMappings: {} } });
  await userEvent.click(screen.getByRole('combobox', { name: 'Insert token' }));
  await waitFor(() => expect(screen.getByText('Country')).toBeVisible());
  expect(screen.queryByText('Excluded')).not.toBeInTheDocument();
  expect(screen.queryByText('Section')).not.toBeInTheDocument();
});
