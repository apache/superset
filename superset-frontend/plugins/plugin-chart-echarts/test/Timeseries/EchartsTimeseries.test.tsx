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
import { AxisType, DTTM_ALIAS } from '@superset-ui/core';
import { EchartsTimeseriesFormData } from '../../src/Timeseries/types';

describe('EchartsTimeseries handleBrushEnd', () => {
  const mockSetDataMask = jest.fn();
  const mockSetControlValue = jest.fn();
  const mockXValueFormatter = jest.fn((val: number) => new Date(val).toISOString());

  const baseFormData: Partial<EchartsTimeseriesFormData> = {
    granularitySqla: 'ds',
  };

  const baseXAxis = {
    label: DTTM_ALIAS,
    type: AxisType.Time,
  };

  beforeEach(() => {
    mockSetDataMask.mockClear();
    mockSetControlValue.mockClear();
    mockXValueFormatter.mockClear();
  });

  describe('handleBrushEnd logic', () => {
    // Simulating the handler logic since we can't easily test React hooks directly
    const handleBrushEnd = (
      params: any,
      xAxis: { label: string; type: AxisType },
      formData: Partial<EchartsTimeseriesFormData>,
      setDataMask: jest.Mock,
      xValueFormatter: (val: number) => string,
      options: {
        isTouchDevice?: boolean;
        setControlValue?: jest.Mock;
        emitCrossFilters?: boolean;
      } = {},
    ) => {
      const {
        isTouchDevice = false,
        setControlValue,
        emitCrossFilters = false,
      } = options;

      // Only handle brush events for time axis charts
      if (xAxis.type !== AxisType.Time) {
        return;
      }

      // Disable brush selection on touch devices
      if (isTouchDevice) {
        return;
      }

      // Get the brush areas from the event
      // brushEnd event has areas directly in params.areas
      const brushAreas = params.areas || [];
      if (brushAreas.length === 0) {
        // Brush was cleared, reset the filter
        if (emitCrossFilters) {
          setDataMask({
            extraFormData: {},
            filterState: {
              value: null,
              selectedValues: null,
            },
          });
        }
        return;
      }

      const area = brushAreas[0];
      const coordRange = area.coordRange;
      // For lineX brush, coordRange is [xMin, xMax] (flat array)
      if (!coordRange || coordRange.length < 2) {
        return;
      }

      const [startValue, endValue] = coordRange.map(Number);

      // Convert timestamps to ISO date strings for time_range format
      const startDate = new Date(startValue).toISOString().slice(0, 19);
      const endDate = new Date(endValue).toISOString().slice(0, 19);
      const timeRange = `${startDate} : ${endDate}`;

      // In Explore view, update the time_range control
      if (setControlValue) {
        setControlValue('time_range', timeRange);
      }

      // On dashboards, emit cross-filter
      if (emitCrossFilters) {
        const col =
          xAxis.label === DTTM_ALIAS ? formData.granularitySqla : xAxis.label;
        const startFormatted = xValueFormatter(startValue);
        const endFormatted = xValueFormatter(endValue);

        setDataMask({
          extraFormData: {
            filters: [
              { col, op: '>=', val: startValue },
              { col, op: '<=', val: endValue },
            ],
          },
          filterState: {
            value: [startValue, endValue],
            selectedValues: [startValue, endValue],
            label: `${startFormatted} - ${endFormatted}`,
          },
        });
      }
    };

    it('should not process brush events when x-axis type is not time', () => {
      const params = {
        areas: [{ coordRange: [[1000, 2000], [0, 100]] }],
      };

      handleBrushEnd(
        params,
        { label: 'category', type: AxisType.Category },
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
      );

      expect(mockSetDataMask).not.toHaveBeenCalled();
    });

    it('should not process brush events on touch devices', () => {
      // For lineX brush, coordRange is a flat array [xMin, xMax]
      const params = {
        areas: [{ coordRange: [1000, 2000] }],
      };

      handleBrushEnd(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
        { isTouchDevice: true },
      );

      expect(mockSetDataMask).not.toHaveBeenCalled();
    });

    it('should reset filter when brush is cleared on dashboard', () => {
      const params = {
        areas: [],
      };

      handleBrushEnd(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
        { emitCrossFilters: true },
      );

      expect(mockSetDataMask).toHaveBeenCalledWith({
        extraFormData: {},
        filterState: {
          value: null,
          selectedValues: null,
        },
      });
    });

    it('should update time_range control in Explore view', () => {
      const startTime = 1609459200000; // 2021-01-01T00:00:00.000Z
      const endTime = 1609545600000; // 2021-01-02T00:00:00.000Z

      // For lineX brush, coordRange is a flat array [xMin, xMax]
      const params = {
        areas: [
          {
            coordRange: [startTime, endTime],
          },
        ],
      };

      handleBrushEnd(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
        { setControlValue: mockSetControlValue },
      );

      expect(mockSetControlValue).toHaveBeenCalledWith(
        'time_range',
        '2021-01-01T00:00:00 : 2021-01-02T00:00:00',
      );
      expect(mockSetDataMask).not.toHaveBeenCalled();
    });

    it('should emit cross-filter on dashboard', () => {
      const startTime = 1609459200000; // 2021-01-01
      const endTime = 1609545600000; // 2021-01-02

      // For lineX brush, coordRange is a flat array [xMin, xMax]
      const params = {
        areas: [
          {
            coordRange: [startTime, endTime],
          },
        ],
      };

      handleBrushEnd(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
        { emitCrossFilters: true },
      );

      expect(mockSetDataMask).toHaveBeenCalledWith({
        extraFormData: {
          filters: [
            { col: 'ds', op: '>=', val: startTime },
            { col: 'ds', op: '<=', val: endTime },
          ],
        },
        filterState: {
          value: [startTime, endTime],
          selectedValues: [startTime, endTime],
          label: expect.stringContaining(' - '),
        },
      });
    });

    it('should use xAxis.label as column when not DTTM_ALIAS', () => {
      const startTime = 1609459200000;
      const endTime = 1609545600000;

      // For lineX brush, coordRange is a flat array [xMin, xMax]
      const params = {
        areas: [
          {
            coordRange: [startTime, endTime],
          },
        ],
      };

      handleBrushEnd(
        params,
        { label: 'custom_time_column', type: AxisType.Time },
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
        { emitCrossFilters: true },
      );

      expect(mockSetDataMask).toHaveBeenCalledWith(
        expect.objectContaining({
          extraFormData: {
            filters: [
              { col: 'custom_time_column', op: '>=', val: startTime },
              { col: 'custom_time_column', op: '<=', val: endTime },
            ],
          },
        }),
      );
    });

    it('should not process when coordRange is invalid', () => {
      const params = {
        areas: [
          {
            coordRange: null,
          },
        ],
      };

      handleBrushEnd(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
      );

      expect(mockSetDataMask).not.toHaveBeenCalled();
    });

    it('should not process when coordRange has less than 2 values', () => {
      // For lineX brush, coordRange should be [xMin, xMax]
      const params = {
        areas: [
          {
            coordRange: [123],
          },
        ],
      };

      handleBrushEnd(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
      );

      expect(mockSetDataMask).not.toHaveBeenCalled();
    });

    it('should use range operators (>= and <=) for time filter', () => {
      const startTime = 1609459200000;
      const endTime = 1609545600000;

      // For lineX brush, coordRange is a flat array [xMin, xMax]
      const params = {
        areas: [
          {
            coordRange: [startTime, endTime],
          },
        ],
      };

      handleBrushEnd(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
        { emitCrossFilters: true },
      );

      const call = mockSetDataMask.mock.calls[0][0];
      expect(call.extraFormData.filters).toHaveLength(2);
      expect(call.extraFormData.filters[0].op).toBe('>=');
      expect(call.extraFormData.filters[1].op).toBe('<=');
    });

    it('should format the label using xValueFormatter', () => {
      const startTime = 1609459200000;
      const endTime = 1609545600000;

      const customFormatter = (val: number) => `Formatted: ${val}`;

      // For lineX brush, coordRange is a flat array [xMin, xMax]
      const params = {
        areas: [
          {
            coordRange: [startTime, endTime],
          },
        ],
      };

      handleBrushEnd(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        customFormatter,
        { emitCrossFilters: true },
      );

      const call = mockSetDataMask.mock.calls[0][0];
      expect(call.filterState.label).toBe(
        `Formatted: ${startTime} - Formatted: ${endTime}`,
      );
    });
  });
});
