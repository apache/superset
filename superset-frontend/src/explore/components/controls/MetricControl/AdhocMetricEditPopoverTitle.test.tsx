// DODO was here
import React from 'react';
import userEvent from '@testing-library/user-event';
import {
  screen,
  render,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';

import AdhocMetricEditPopoverTitle, {
  AdhocMetricEditPopoverTitleProps,
} from 'src/explore/components/controls/MetricControl/AdhocMetricEditPopoverTitle';

const titleProps = {
  label: 'COUNT(*)',
  hasCustomLabel: false,
};

const setup = (props: Partial<AdhocMetricEditPopoverTitleProps> = {}) => {
  const onChange = jest.fn();

  const { container } = render(
    <AdhocMetricEditPopoverTitle
      title={titleProps}
      // DODO added
      onChangeEN={onChange}
      onChangeRU={onChange}
      {...props}
    />,
  );

  return { container, onChange };
};

test('should render', async () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();

  expect(screen.queryByTestId('AdhocMetricTitle')).not.toBeInTheDocument();
  expect(screen.getByText(titleProps.label)).toBeVisible();
});

test('should render tooltip on hover', async () => {
  const { container } = setup();

  expect(screen.queryByText('Click to edit label')).not.toBeInTheDocument();
  fireEvent.mouseOver(screen.getByTestId('AdhocMetricEditTitle#trigger'));

  expect(await screen.findByText('Click to edit label')).toBeInTheDocument();
  expect(
    container.parentElement?.getElementsByClassName('ant-tooltip-hidden')
      .length,
  ).toBe(0);

  fireEvent.mouseOut(screen.getByTestId('AdhocMetricEditTitle#trigger'));
  await waitFor(() => {
    expect(
      container.parentElement?.getElementsByClassName('ant-tooltip-hidden')
        .length,
    ).toBe(1);
  });
});

test('render non-interactive span with title when edit is disabled', async () => {
  const { container } = setup({ isEditDisabled: true });
  expect(container).toBeInTheDocument();

  expect(screen.queryByTestId('AdhocMetricTitle')).toBeInTheDocument();
  expect(screen.getByText(titleProps.label)).toBeVisible();
  expect(
    screen.queryByTestId('AdhocMetricEditTitle#trigger'),
  ).not.toBeInTheDocument();
});

test('render default label if no title is provided', async () => {
  const { container } = setup({ title: undefined });
  expect(container).toBeInTheDocument();

  expect(screen.queryByTestId('AdhocMetricTitle')).not.toBeInTheDocument();
  expect(screen.getByText('My metric')).toBeVisible();
});

test('start and end the title edit mode', async () => {
  const { container, onChange } = setup();
  expect(container).toBeInTheDocument();

  expect(container.getElementsByTagName('i')[0]).toBeVisible();
  expect(screen.getByText(titleProps.label)).toBeVisible();
  expect(
    screen.queryByTestId('AdhocMetricEditTitle#input'),
  ).not.toBeInTheDocument();

  fireEvent.click(
    container.getElementsByClassName('AdhocMetricEditPopoverTitle')[0],
  );

  expect(await screen.findByTestId('AdhocMetricEditTitle#input')).toBeVisible();
  userEvent.type(screen.getByTestId('AdhocMetricEditTitle#input'), 'Test');

  expect(onChange).toHaveBeenCalledTimes(4);
  fireEvent.keyPress(screen.getByTestId('AdhocMetricEditTitle#input'), {
    key: 'Enter',
    charCode: 13,
  });

  expect(
    screen.queryByTestId('AdhocMetricEditTitle#input'),
  ).not.toBeInTheDocument();

  fireEvent.click(
    container.getElementsByClassName('AdhocMetricEditPopoverTitle')[0],
  );

  expect(await screen.findByTestId('AdhocMetricEditTitle#input')).toBeVisible();
  userEvent.type(
    screen.getByTestId('AdhocMetricEditTitle#input'),
    'Second test',
  );
  expect(onChange).toHaveBeenCalled();

  fireEvent.blur(screen.getByTestId('AdhocMetricEditTitle#input'));
  expect(
    screen.queryByTestId('AdhocMetricEditTitle#input'),
  ).not.toBeInTheDocument();
});
