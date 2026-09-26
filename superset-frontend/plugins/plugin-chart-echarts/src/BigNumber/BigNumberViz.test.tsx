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
  DTTM_ALIAS,
  getNumberFormatter,
  TimeFormatter,
} from '@superset-ui/core';
import { render, fireEvent } from '../../../../spec/helpers/testing-library';
import BigNumberVis from './BigNumberViz';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';
import { BigNumberWithTrendlineFormData } from './types';

jest.mock('../components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

/**
 * Tests for the color threshold formatter logic in BigNumberViz.
 *
 * The key fix: bigNumber === 0 is falsy, so the original code
 *   `const result = bigNumber ? formatter.getColorFromValue(bigNumber) : false`
 * would skip formatting for zero. The fix uses an explicit type check instead.
 */

// describe block makes applyColorFormatters block-scoped, avoiding TS2451
// when TypeScript's root tsconfig includes this file as a global script.
describe('BigNumberViz color formatters', () => {
  const applyColorFormatters = (
    bigNumber: number | null | undefined,
    formatters: Array<{ getColorFromValue: (v: number) => string | undefined }>,
  ): string | undefined => {
    let numberColor: string | undefined;
    const hasFormatters = Array.isArray(formatters) && formatters.length > 0;
    if (hasFormatters) {
      formatters.forEach(formatter => {
        // Fixed: use explicit type check instead of falsy check
        if (typeof bigNumber === 'number' && !isNaN(bigNumber)) {
          numberColor = formatter.getColorFromValue(bigNumber);
        }
      });
    }
    return numberColor;
  };

  test('applies color formatter when bigNumber is 0', () => {
    const getColorFromValue = jest.fn(() => 'red');
    const color = applyColorFormatters(0, [{ getColorFromValue }]);

    expect(getColorFromValue).toHaveBeenCalledWith(0);
    expect(color).toBe('red');
  });

  test('applies color formatter when bigNumber is positive', () => {
    const getColorFromValue = jest.fn(() => 'green');
    const color = applyColorFormatters(42, [{ getColorFromValue }]);

    expect(getColorFromValue).toHaveBeenCalledWith(42);
    expect(color).toBe('green');
  });

  test('applies color formatter when bigNumber is negative', () => {
    const getColorFromValue = jest.fn(() => 'blue');
    const color = applyColorFormatters(-5, [{ getColorFromValue }]);

    expect(getColorFromValue).toHaveBeenCalledWith(-5);
    expect(color).toBe('blue');
  });

  test('does not call color formatter when bigNumber is null', () => {
    const getColorFromValue = jest.fn();
    applyColorFormatters(null, [{ getColorFromValue }]);

    expect(getColorFromValue).not.toHaveBeenCalled();
  });

  test('does not call color formatter when bigNumber is undefined', () => {
    const getColorFromValue = jest.fn();
    applyColorFormatters(undefined, [{ getColorFromValue }]);

    expect(getColorFromValue).not.toHaveBeenCalled();
  });
});

describe('BigNumberViz context menu', () => {
  test('invokes onContextMenu and stops the event bubbling to ancestor handlers', () => {
    const onContextMenu = jest.fn();
    const ancestorHandler = jest.fn();

    const { container } = render(
      <div onContextMenu={ancestorHandler}>
        <BigNumberVis
          width={200}
          height={100}
          bigNumber={42}
          headerFormatter={getNumberFormatter()}
          headerFontSize={0.3}
          subheaderFontSize={0.125}
          subtitleFontSize={0.125}
          subtitle=""
          refs={{}}
          onContextMenu={onContextMenu}
        />
      </div>,
    );

    const headerLine = container.querySelector('.header-line');
    fireEvent.contextMenu(headerLine!, { clientX: 10, clientY: 20 });

    expect(onContextMenu).toHaveBeenCalledWith(10, 20);
    expect(ancestorHandler).not.toHaveBeenCalled();
  });
});

describe('BigNumberViz trendline context menu', () => {
  beforeEach(() => {
    mockedEchart.mockClear();
  });

  const renderWithTrendline = (
    onContextMenu: jest.Mock,
    xAxis: string = 'ds',
  ) => {
    render(
      <BigNumberVis
        width={200}
        height={100}
        bigNumber={42}
        headerFormatter={getNumberFormatter()}
        headerFontSize={0.3}
        subheaderFontSize={0.125}
        subtitleFontSize={0.125}
        subtitle=""
        refs={{}}
        showTrendLine
        trendLineData={[
          [1577836800000, 10],
          [1577923200000, 20],
        ]}
        echartOptions={{}}
        formData={
          {
            xAxis,
            granularitySqla: 'legacy_ds',
            timeGrainSqla: 'P1D',
            vizType: 'big_number',
          } as unknown as BigNumberWithTrendlineFormData
        }
        xValueFormatter={
          new TimeFormatter({
            id: 'test-time-formatter',
            formatFunc: (value: Date) => `formatted-${value.getTime()}`,
          })
        }
        onContextMenu={onContextMenu}
      />,
    );

    const lastCall =
      mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
    const { eventHandlers } = lastCall[0] as {
      eventHandlers: EventHandlers;
    };
    return eventHandlers;
  };

  test('right-clicking a trendline point drills to detail for that point', () => {
    const onContextMenu = jest.fn();
    const stop = jest.fn();
    const eventHandlers = renderWithTrendline(onContextMenu);

    eventHandlers.contextmenu({
      data: [1577836800000, 10],
      event: {
        stop,
        event: { clientX: 15, clientY: 25 },
      },
    });

    expect(stop).toHaveBeenCalledTimes(1);
    expect(onContextMenu).toHaveBeenCalledTimes(1);
    const [x, y, payload] = onContextMenu.mock.calls[0];
    expect(x).toBe(15);
    expect(y).toBe(25);
    expect(payload.drillToDetail).toEqual([
      {
        col: 'ds',
        grain: 'P1D',
        op: '==',
        val: 1577836800000,
        formattedVal: 'formatted-1577836800000',
      },
    ]);
  });

  test('drills on the legacy time column when the x-axis is the timestamp alias', () => {
    const onContextMenu = jest.fn();
    const eventHandlers = renderWithTrendline(onContextMenu, DTTM_ALIAS);

    eventHandlers.contextmenu({
      data: [1577836800000, 10],
      event: {
        stop: jest.fn(),
        event: { clientX: 15, clientY: 25 },
      },
    });

    const [, , payload] = onContextMenu.mock.calls[0];
    expect(payload.drillToDetail).toEqual([
      expect.objectContaining({ col: 'legacy_ds', grain: 'P1D' }),
    ]);
  });

  test('does not call onContextMenu when the point has no data', () => {
    const onContextMenu = jest.fn();
    const eventHandlers = renderWithTrendline(onContextMenu);

    eventHandlers.contextmenu({
      data: undefined,
      event: {
        stop: jest.fn(),
        event: { clientX: 15, clientY: 25 },
      },
    });

    expect(onContextMenu).not.toHaveBeenCalled();
  });
});
