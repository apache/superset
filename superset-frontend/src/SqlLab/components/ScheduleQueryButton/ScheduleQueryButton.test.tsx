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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';

// The component reads SCHEDULED_QUERIES from bootstrap data at module load,
// so the mock must be in place before the import below resolves.
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    common: {
      conf: {
        SCHEDULED_QUERIES: {
          JSONSCHEMA: {
            title: 'Schedule',
            type: 'object',
            properties: {
              output_table: {
                type: 'string',
                title: 'Output table name',
              },
              start_date: {
                type: 'string',
                title: 'Start date',
                format: 'date-time',
                default: 'tomorrow at 9am',
              },
              recipients: {
                type: 'array',
                title: 'Recipients',
                items: { type: 'string' },
              },
            },
            required: ['output_table'],
          },
          UISCHEMA: {},
          VALIDATION: [],
        },
      },
    },
  }),
}));

// eslint-disable-next-line import/first
import ScheduleQueryButton from '.';

// Smoke test for the @rjsf/core v6 major bump: this is rjsf's sole consumer
// in the codebase, and the form is rendered from runtime config, so a
// breaking rjsf change stays invisible to TypeScript. Opening the modal
// exercises SchemaForm + validator-ajv8 end to end in jsdom.
test('renders the rjsf schedule form fields inside the modal', async () => {
  render(
    <ScheduleQueryButton
      sql="SELECT 1"
      schema="main"
      dbId={1}
      scheduleQueryWarning={null}
      disabled={false}
      tooltip="Schedule query"
    />,
    { useRedux: true },
  );

  // ModalTrigger wraps its trigger node in a div[role="button"], so both the
  // wrapper and the inner antd button match ('button', 'Schedule') — target
  // the wrapper via its test id.
  await userEvent.click(screen.getByTestId('span-modal-trigger'));

  // Modal chrome + the rjsf-rendered schema fields
  expect(await screen.findByText('Schedule query')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText('Output table name')).toBeInTheDocument();
  });
  expect(screen.getByText('Start date')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
});

// StyledJsonSchema hides rjsf's glyphicon <i> (no font shipped) and draws
// +/up/down/- glyphs via ::after on the button classes. rjsf 6 renamed the
// array-item classes from "array-item-*" to "rjsf-array-item-*" — with the
// old selectors the buttons rendered completely empty. Pin the v6 class
// names the styled overrides depend on.
test('array fields render add/reorder/remove buttons with the rjsf 6 classes', async () => {
  render(
    <ScheduleQueryButton
      sql="SELECT 1"
      schema="main"
      dbId={1}
      scheduleQueryWarning={null}
      disabled={false}
      tooltip="Schedule query"
    />,
    { useRedux: true },
  );

  await userEvent.click(screen.getByTestId('span-modal-trigger'));
  expect(await screen.findByText('Recipients')).toBeInTheDocument();

  const addButton = document.querySelector('button.btn-add');
  expect(addButton).toBeInTheDocument();

  // Add two items so both move buttons can render enabled
  await userEvent.click(addButton as HTMLElement);
  await userEvent.click(addButton as HTMLElement);

  await waitFor(() => {
    expect(
      document.querySelectorAll('button.rjsf-array-item-remove'),
    ).toHaveLength(2);
    expect(
      document.querySelector('button.rjsf-array-item-move-up'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('button.rjsf-array-item-move-down'),
    ).toBeInTheDocument();
  });
});
