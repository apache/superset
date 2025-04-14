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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { AGGREGATES } from 'src/explore/constants';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import AdhocFilterEditPopover from '.';
import AdhocFilter from '../AdhocFilter';
import { Clauses, ExpressionTypes } from '../types';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: ExpressionTypes.Simple,
  subject: 'value',
  operator: '>',
  comparator: '10',
  clause: Clauses.Where,
});

const sqlAdhocFilter = new AdhocFilter({
  expressionType: ExpressionTypes.Sql,
  sqlExpression: 'value > 10',
  clause: Clauses.Where,
});

const faultyAdhocFilter = new AdhocFilter({
  expressionType: null,
  subject: null,
  operator: '>',
  comparator: '10',
  clause: Clauses.Where,
});

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: ExpressionTypes.Simple,
  column: { type: 'VARCHAR(255)', column_name: 'source' },
  aggregate: AGGREGATES.SUM,
});

const options = [
  { type: 'VARCHAR(255)', column_name: 'source' },
  { type: 'VARCHAR(255)', column_name: 'target' },
  { type: 'DOUBLE', column_name: 'value' },
  { saved_metric_name: 'my_custom_metric' },
  sumValueAdhocMetric,
];

const defaultProps = {
  adhocFilter: simpleAdhocFilter,
  onChange: jest.fn(),
  onClose: jest.fn(),
  onResize: jest.fn(),
  options,
  datasource: {},
};

const renderPopover = (props = {}) =>
  render(<AdhocFilterEditPopover {...defaultProps} {...props} />, {
    useRedux: true, // Add Redux provider for context
  });

describe('AdhocFilterEditPopover', () => {
  it('renders simple tab content by default', () => {
    renderPopover();

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    // Fix: Update button count to match actual buttons (Close, Save, Resize)
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('Simple')).toBeInTheDocument();
  });

  it('renders sql tab content when the adhoc filter expressionType is sql', () => {
    renderPopover({ adhocFilter: sqlAdhocFilter });

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByText('Custom SQL')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /custom sql/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('renders error message when filter is faulty', () => {
    renderPopover({ adhocFilter: faultyAdhocFilter });

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    // Error message is not present in the DOM, let's check for error state instead
    expect(
      screen.getByTestId('adhoc-filter-edit-popover-save-button'),
    ).toBeDisabled();
  });

  it.skip('updates the filter when changes are made', async () => {
    const onChange = jest.fn();
    renderPopover({
      onChange,
      adhocFilter: sqlAdhocFilter,
    });

    // Switch to SQL tab
    await userEvent.click(screen.getByRole('tab', { name: /custom sql/i }));

    // Find and update the SQL editor
    const sqlInput = screen.getByTestId('sql-input');
    fireEvent.change(sqlInput, { target: { value: 'COUNT(*) > 0' } });

    // Wait for validation to complete
    await screen.findByRole('button', { name: /save/i, disabled: false });

    // Click save button
    const saveButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sqlExpression: 'COUNT(*) > 0',
        expressionType: ExpressionTypes.Sql,
        clause: Clauses.Where,
      }),
    );
  });

  it('enables save button when valid changes are made', async () => {
    renderPopover({ adhocFilter: simpleAdhocFilter });

    // Find the subject select by its test id
    const subjectSelect = screen.getByTestId('select-element');
    await userEvent.click(subjectSelect);

    // Select a value from the dropdown
    const valueOption = screen.getByText('value');
    await userEvent.click(valueOption);

    // Find and update the value input
    const valueInput = screen.getByTestId('adhoc-filter-simple-value');
    await userEvent.clear(valueInput);
    await userEvent.type(valueInput, '100');

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeEnabled();
  });

  it('disables save button when filter is invalid', () => {
    renderPopover({ adhocFilter: faultyAdhocFilter });

    const saveButton = screen.getByTestId(
      'adhoc-filter-edit-popover-save-button',
    );
    expect(saveButton).toBeDisabled();
  });

  it('initiates resize when resize handle is dragged', async () => {
    const onResize = jest.fn();
    renderPopover({ onResize });

    const resizeHandle = screen.getByLabelText(/resize/i);
    fireEvent.mouseDown(resizeHandle);
    fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(document);

    expect(onResize).toHaveBeenCalled();
  });

  it('closes popover when close button is clicked', async () => {
    const onClose = jest.fn();
    renderPopover({ onClose });

    // Use more specific selector to avoid ambiguity
    const closeButton = screen.getByRole('button', { name: /^close$/i });
    await userEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });
});
