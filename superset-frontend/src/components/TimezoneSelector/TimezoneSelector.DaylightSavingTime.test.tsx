
import { FC } from 'react';
import { render, waitFor, screen } from 'spec/helpers/testing-library';
import type { TimezoneSelectorProps } from './index';
import userEvent from '@testing-library/user-event';

const loadComponent = (mockCurrentTime?: string) => {
    if (mockCurrentTime) {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(mockCurrentTime));
    }
    return new Promise<FC<TimezoneSelectorProps>>(resolve => {
        const { default: TimezoneSelector } = module.require('./index');
        resolve(TimezoneSelector);
        jest.useRealTimers();
    });
};

test.only('render timezones in correct order for daylight saving time', async () => {
    const TimezoneSelector = await loadComponent('2022-07-01');
    const onTimezoneChange = jest.fn();
    render(
      <TimezoneSelector
        onTimezoneChange={onTimezoneChange}
        timezone="America/Nassau"
      />,
    );

    const searchInput = screen.getByRole('combobox');
    userEvent.click(searchInput);

    const options = await waitFor(() => document.querySelectorAll('.ant-select-item-option-content'));

    // first option is always current timezone
    expect(options[0]).toHaveTextContent('GMT -04:00 (Eastern Daylight Time)');
    expect(options[1]).toHaveTextContent('GMT -11:00 (Pacific/Pago_Pago)');
    expect(options[2]).toHaveTextContent('GMT -10:00 (Hawaii Standard Time)');
    expect(options[3]).toHaveTextContent('GMT -09:30 (Pacific/Marquesas)');
})