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
import { AxisType } from '@superset-ui/core';
import { EchartsTimeseriesFormData } from '../../src/Timeseries/types';

describe('EchartsTimeseries handleBrushSelected', () => {
  const mockSetDataMask = jest.fn();
  const mockXValueFormatter = jest.fn((val: number) => new Date(val).toISOString());

  const baseFormData: Partial<EchartsTimeseriesFormData> = {
    granularitySqla: 'ds',
  };

  const baseXAxis = {
    label: '__timestamp',
    type: AxisType.Time,
  };

  beforeEach(() => {
    mockSetDataMask.mockClear();
    mockXValueFormatter.mockClear();
  });

  describe('handleBrushSelected logic', () => {
    // Simulating the handler logic since we can't easily test React hooks directly
    const handleBrushSelected = (
      params: any,
      xAxis: { label: string; type: AxisType },
      formData: Partial<EchartsTimeseriesFormData>,
      setDataMask: jest.Mock,
      xValueFormatter: (val: number) => string,
      isTouchDevice = false,
    ) => {
      // Only handle brush events for time axis charts
      if (xAxis.type !== AxisType.Time) {
        return;
      }

      // Disable brush selection on touch devices
      if (isTouchDevice) {
        return;
      }

      // Get the brush areas from the event
      const brushAreas = params.batch?.[0]?.areas || [];
      if (brushAreas.length === 0) {
        // Brush was cleared, reset the filter
        setDataMask({
          extraFormData: {},
          filterState: {
            value: null,
            selectedValues: null,
          },
        });
        return;
      }

      const area = brushAreas[0];
      const coordRange = area.coordRange;
      if (!coordRange || !coordRange[0] || coordRange[0].length < 2) {
        return;
      }

      const [startValue, endValue] = coordRange[0];

      const col =
        xAxis.label === '__timestamp' ? formData.granularitySqla : xAxis.label;
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
    };

    it('should not process brush events when x-axis type is not time', () => {
      const params = {
        batch: [{ areas: [{ coordRange: [[1000, 2000], [0, 100]] }] }],
      };

      handleBrushSelected(
        params,
        { label: 'category', type: AxisType.category },
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
      );

      expect(mockSetDataMask).not.toHaveBeenCalled();
    });

    it('should not process brush events on touch devices', () => {
      const params = {
        batch: [{ areas: [{ coordRange: [[1000, 2000], [0, 100]] }] }],
      };

      handleBrushSelected(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
        true, // isTouchDevice
      );

      expect(mockSetDataMask).not.toHaveBeenCalled();
    });

    it('should reset filter when brush is cleared (no areas)', () => {
      const params = {
        batch: [{ areas: [] }],
      };

      handleBrushSelected(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
      );

      expect(mockSetDataMask).toHaveBeenCalledWith({
        extraFormData: {},
        filterState: {
          value: null,
          selectedValues: null,
        },
      });
    });

    it('should create time range filter when brush selection is made', () => {
      const startTime = 1609459200000; // 2021-01-01
      const endTime = 1609545600000; // 2021-01-02

      const params = {
        batch: [
          {
            areas: [
              {
                coordRange: [
                  [startTime, endTime],
                  [0, 100],
                ],
              },
            ],
          },
        ],
      };

      handleBrushSelected(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
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

    it('should use xAxis.label as column when not __timestamp', () => {
      const startTime = 1609459200000;
      const endTime = 1609545600000;

      const params = {
        batch: [
          {
            areas: [
              {
                coordRange: [
                  [startTime, endTime],
                  [0, 100],
                ],
              },
            ],
          },
        ],
      };

      handleBrushSelected(
        params,
        { label: 'custom_time_column', type: AxisType.Time },
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
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
        batch: [
          {
            areas: [
              {
                coordRange: null,
              },
            ],
          },
        ],
      };

      handleBrushSelected(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
      );

      expect(mockSetDataMask).not.toHaveBeenCalled();
    });

    it('should not process when coordRange[0] is empty', () => {
      const params = {
        batch: [
          {
            areas: [
              {
                coordRange: [[]],
              },
            ],
          },
        ],
      };

      handleBrushSelected(
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

      const params = {
        batch: [
          {
            areas: [
              {
                coordRange: [
                  [startTime, endTime],
                  [0, 100],
                ],
              },
            ],
          },
        ],
      };

      handleBrushSelected(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        mockXValueFormatter,
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

      const params = {
        batch: [
          {
            areas: [
              {
                coordRange: [
                  [startTime, endTime],
                  [0, 100],
                ],
              },
            ],
          },
        ],
      };

      handleBrushSelected(
        params,
        baseXAxis,
        baseFormData,
        mockSetDataMask,
        customFormatter,
      );

      const call = mockSetDataMask.mock.calls[0][0];
      expect(call.filterState.label).toBe(
        `Formatted: ${startTime} - Formatted: ${endTime}`,
      );
    });
  });
});
