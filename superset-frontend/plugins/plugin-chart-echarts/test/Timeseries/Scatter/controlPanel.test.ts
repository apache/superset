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
import { ControlPanelsContainerProps } from '@superset-ui/chart-controls/types';
import controlPanel from '../../../src/Timeseries/Regular/Scatter/controlPanel';

const config = controlPanel;

describe('Scatter Chart Control Panel', () => {
  const getControl = (controlName: string) => {
    for (const section of config.controlPanelSections) {
      if (section && section.controlSetRows) {
        for (const row of section.controlSetRows) {
          for (const control of row) {
            if (
              typeof control === 'object' &&
              control !== null &&
              'name' in control &&
              control.name === controlName
            ) {
              return control;
            }
          }
        }
      }
    }

    return null;
  }

  const mockControls = (xAxisColumn: string | null, xAxisType: string | null): ControlPanelsContainerProps => {
        const options = xAxisType ? [{ column_name: xAxisColumn, type: xAxisType }] : [];

        return {
          controls: {
            // @ts-ignore
            x_axis: {
              value: xAxisColumn,
              options: options,
            },
          },
        };
      };

  describe('x_axis_time_format control', () => {
    const timeFormatControl: any = getControl('x_axis_time_format');

    it('should include x_axis_time_format control in the panel', () => {
      expect(timeFormatControl).toBeDefined();
    });

    it('should have correct default value for x_axis_time_format', () => {
      expect(timeFormatControl).toBeDefined();
      expect(timeFormatControl.config).toBeDefined();
      expect(timeFormatControl.config.default).toBe('smart_date');
    });

    it('should have visibility function for x_axis_time_format', () => {
      expect(timeFormatControl).toBeDefined();
      expect(timeFormatControl.config.visibility).toBeDefined();
      expect(typeof timeFormatControl.config.visibility).toBe('function');

      // The visibility function exists - the exact logic is tested implicitly through UI behavior
      // The important part is that the control has proper visibility configuration
    });

    describe('x_axis_time_format control visibility', () => {
      const isVisible = (xAxisColumn: string | null, xAxisType: string | null): boolean => {
        const props = mockControls(xAxisColumn, xAxisType);
        const visibilityFn = timeFormatControl?.config?.visibility;
        return visibilityFn ? visibilityFn(props) : false;
      };

      it('should be visible for any data types include TIME', () => {
        expect(isVisible("time_column", "TIME")).toBe(true);
        expect(isVisible("time_column", "TIME WITH TIME ZONE")).toBe(true);
        expect(isVisible("time_column", "TIMESTAMP WITH TIME ZONE")).toBe(true);
        expect(isVisible("time_column", "TIMESTAMP WITHOUT TIME ZONE")).toBe(true);
      });

      it('should be hidden for any data types include TIME', () => {
        expect(isVisible("null", "null")).toBe(false);
        expect(isVisible(null, null)).toBe(false);
        expect(isVisible("float_column", "FLOAT")).toBe(false);
      });
    });
  });

  describe('x_axis_number_format control', () => {
    const numberFormatControl: any = getControl('x_axis_number_format');

    it('should include x_axis_number_format control in the panel', () => {
      expect(numberFormatControl).toBeDefined();
    });

    it('should have correct default value for x_axis_number_format', () => {
      expect(numberFormatControl).toBeDefined();
      expect(numberFormatControl.config).toBeDefined();
      expect(numberFormatControl.config.default).toBe('SMART_NUMBER');
    });

    it('should have visibility function for x_axis_number_format', () => {
      expect(numberFormatControl).toBeDefined();
      expect(numberFormatControl.config.visibility).toBeDefined();
      expect(typeof numberFormatControl.config.visibility).toBe('function');

      // The visibility function exists - the exact logic is tested implicitly through UI behavior
      // The important part is that the control has proper visibility configuration
    });

    describe('x_axis_number_format control visibility', () => {
      const isVisible = (xAxisColumn: string | null, xAxisType: string | null): boolean => {
        const props = mockControls(xAxisColumn, xAxisType);
        const visibilityFn = numberFormatControl?.config?.visibility;
        return visibilityFn ? visibilityFn(props) : false;
      };

      it('should be visible for any floating-point data types', () => {
        expect(isVisible("float_column", 'FLOAT')).toBe(true);
        expect(isVisible("double_column", "DOUBLE")).toBe(true);
        expect(isVisible("real_column", "REAL")).toBe(true);
        expect(isVisible("numeric_column", "NUMERIC")).toBe(true);
        expect(isVisible("decimal_column", "DECIMAL")).toBe(true);
      });

      it('should be hidden for any non-floating-point data types', () => {
        expect(isVisible("string_column", "VARCHAR")).toBe(false);
        expect(isVisible("null", "null")).toBe(false);
        expect(isVisible(null, null)).toBe(false);
        expect(isVisible("time_column", "TIMESTAMP WITHOUT TIME ZONE")).toBe(false);
      });
    });
  });
});
