import { NO_TIME_RANGE } from '@superset-ui/core';
import { screen, render, fireEvent, userEvent, waitFor } from 'spec/helpers/testing-library';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import { PersianCalendarFrame } from 'src/explore/components/controls/DateFilterControl/components/PersianCalendarFrame';

jest.mock(
  'src/explore/components/controls/DateFilterControl/components/JalaliDatePicker',
  () => {
    const { extendedDayjs } = jest.requireActual(
      '@superset-ui/core/utils/dates',
    );
    return {
      JalaliDatePicker: ({ value, onChange, placeholder, mode }: any) => {
        if (mode === 'range') {
          const [start, end] = (value as any[]) ?? [];
          return (
            <div>
              <input
                aria-label={`${placeholder}-start`}
                value={start ? start.format('YYYY-MM-DD') : ''}
                onChange={event =>
                  onChange([
                    event.target.value
                      ? extendedDayjs(event.target.value, 'YYYY-MM-DD')
                      : null,
                    end || null,
                  ])
                }
              />
              <input
                aria-label={`${placeholder}-end`}
                value={end ? end.format('YYYY-MM-DD') : ''}
                onChange={event =>
                  onChange([
                    start || null,
                    event.target.value
                      ? extendedDayjs(event.target.value, 'YYYY-MM-DD')
                      : null,
                  ])
                }
              />
            </div>
          );
        }
        return (
          <input
            aria-label={placeholder}
            value={value ? (value as any).format('YYYY-MM-DD') : ''}
            onChange={event =>
              onChange(
                event.target.value
                  ? extendedDayjs(event.target.value, 'YYYY-MM-DD')
                  : null,
              )
            }
          />
        );
      },
    };
  },
);

test('renders preset selection and applies relative range on change', async () => {
  const onChange = jest.fn();
  render(<PersianCalendarFrame value="Last 7 days" onChange={onChange} />);

  await userEvent.click(screen.getByRole('radio', { name: '۳۰ روز گذشته' }));

  expect(onChange).toHaveBeenCalledWith('Last 30 days');
});

test('emits custom range when both Jalali pickers are filled', async () => {
  const onChange = jest.fn();
  render(<PersianCalendarFrame value={NO_TIME_RANGE} onChange={onChange} />);

  await userEvent.click(screen.getByRole('radio', { name: 'بازه سفارشی' }));

  const startInput = screen.getByLabelText('بازه تاریخ را انتخاب کنید-start');
  const endInput = screen.getByLabelText('بازه تاریخ را انتخاب کنید-end');

  fireEvent.change(startInput, { target: { value: '2024-01-10' } });
  fireEvent.change(endInput, { target: { value: '2024-01-12' } });

  expect(onChange).toHaveBeenLastCalledWith('2024-01-10 : 2024-01-12');
});

test('parses persisted custom range values', () => {
  render(
    <PersianCalendarFrame
      value="2024-01-01 : 2024-01-05"
      onChange={jest.fn()}
    />,
  );

  expect(
    screen.getByText(/بازه انتخاب‌شده \(جلالی\)/i),
  ).toBeInTheDocument();
});

test('custom range defaults both inputs to today when enabled', async () => {
  render(<PersianCalendarFrame value={NO_TIME_RANGE} onChange={jest.fn()} />);

  await userEvent.click(screen.getByRole('radio', { name: 'بازه سفارشی' }));

  const isoDate = dayjs().format('YYYY-MM-DD');
  await waitFor(() =>
    expect(
      screen.getByLabelText('بازه تاریخ را انتخاب کنید-start'),
    ).toHaveValue(isoDate),
  );
  expect(
    screen.getByLabelText('بازه تاریخ را انتخاب کنید-end'),
  ).toHaveValue(isoDate);
});
