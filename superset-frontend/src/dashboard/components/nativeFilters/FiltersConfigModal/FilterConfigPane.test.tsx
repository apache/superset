import React from 'react';
import { dashboardLayout } from 'spec/fixtures/mockDashboardLayout';
import { buildNativeFilter } from 'spec/fixtures/mockNativeFilters';
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import FilterConfigPane from './FilterConfigurePane';

const defaultProps = {
  children: jest.fn(),
  getFilterTitle: jest.fn(),
  onChange: jest.fn(),
  onEdit: jest.fn(),
  onRearrange: jest.fn(),
  restoreFilter: jest.fn(),
  currentFilterId: 'NATIVE_FILTER-1',
  filterGroups: [['NATIVE_FILTER-2', 'NATIVE_FILTER-1'], ['NATIVE_FILTER-3']],
  removedFilters: {},
};
const defaultState = {
  dashboardInfo: {
    metadata: {
      native_filter_configuration: [
        buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']),
        buildNativeFilter('NATIVE_FILTER-2', 'country', []),
        buildNativeFilter('NATIVE_FILTER-3', 'product', []),
      ],
    },
  },
  dashboardLayout,
};

function defaultRender(initialState: any = defaultState, props = defaultProps) {
  return render(<FilterConfigPane {...props} />, {
    initialState,
    useDnd: true,
    useRedux: true,
  });
}

test('renders form', async () => {
  defaultRender();
  expect(defaultProps.children).toHaveBeenCalledTimes(3);
});
test('drag and drop', async () => {
  defaultRender();
  const [countryStateFilter, productFilter] = screen.getAllByAltText(
    'dragimage',
  );
  fireEvent.dragStart(productFilter);
  fireEvent.dragEnter(countryStateFilter);
  fireEvent.dragOver(countryStateFilter);
  fireEvent.drop(countryStateFilter);
  fireEvent.dragLeave(countryStateFilter);
  fireEvent.dragEnd(productFilter);
  expect(defaultProps.onRearrange).toHaveBeenCalledTimes(1);
});

test('remove filter', async () => {
  defaultRender();
  // First trash icon
  const removeFilterIcon = document.querySelector("[alt='RemoveFilter']")!;
  fireEvent(
    removeFilterIcon,
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(defaultProps.onEdit).toHaveBeenCalledWith('NATIVE_FILTER-2');
});

test('add filter', async () => {
  defaultRender();
  // First trash icon
  const removeFilterIcon = screen.getByText('Add filter')!;
  fireEvent(
    removeFilterIcon,
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(defaultProps.onEdit).toBeCalledTimes(1);
});
