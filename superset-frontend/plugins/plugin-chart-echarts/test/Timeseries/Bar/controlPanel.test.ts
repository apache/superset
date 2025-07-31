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
import controlPanel from '../../../src/Timeseries/Regular/Bar/controlPanel';
import { OrientationType } from '../../../src/Timeseries/types';

describe('Bar Chart Control Panel', () => {
  describe('x_axis_time_format control', () => {
    it('should include x_axis_time_format control in the panel', () => {
      const config = controlPanel;
      
      // Find the Chart Options section
      const chartOptionsSection = config.controlPanelSections.find(
        section => section.label === 'Chart Options'
      );
      
      expect(chartOptionsSection).toBeDefined();
      expect(chartOptionsSection?.controlSetRows).toBeDefined();

      // Look for x_axis_time_format control in the nested controlSetRows
      let foundTimeFormatControl = false;
      chartOptionsSection?.controlSetRows.forEach(row => {
        row.forEach(control => {
          if (typeof control === 'object' && control !== null && 'name' in control) {
            if (control.name === 'x_axis_time_format') {
              foundTimeFormatControl = true;
            }
          }
        });
      });

      expect(foundTimeFormatControl).toBe(true);
    });

    it('should have correct default value for x_axis_time_format', () => {
      const config = controlPanel;
      
      // Find the x_axis_time_format control
      let timeFormatControl: any = null;
      config.controlPanelSections.forEach(section => {
        section.controlSetRows?.forEach(row => {
          row.forEach(control => {
            if (typeof control === 'object' && control !== null && 'name' in control) {
              if (control.name === 'x_axis_time_format') {
                timeFormatControl = control;
              }
            }
          });
        });
      });

      expect(timeFormatControl).toBeDefined();
      expect(timeFormatControl.config).toBeDefined();
      expect(timeFormatControl.config.default).toBe('smart_date');
    });

    it('should have visibility function for x_axis_time_format', () => {
      const config = controlPanel;
      
      // Find the x_axis_time_format control
      let timeFormatControl: any = null;
      config.controlPanelSections.forEach(section => {
        section.controlSetRows?.forEach(row => {
          row.forEach(control => {
            if (typeof control === 'object' && control !== null && 'name' in control) {
              if (control.name === 'x_axis_time_format') {
                timeFormatControl = control;
              }
            }
          });
        });
      });

      expect(timeFormatControl).toBeDefined();
      expect(timeFormatControl.config.visibility).toBeDefined();
      expect(typeof timeFormatControl.config.visibility).toBe('function');

      // The visibility function exists - the exact logic is tested implicitly through UI behavior
      // The important part is that the control has proper visibility configuration
    });

    it('should have proper control configuration', () => {
      const config = controlPanel;
      
      // Find the x_axis_time_format control
      let timeFormatControl: any = null;
      config.controlPanelSections.forEach(section => {
        section.controlSetRows?.forEach(row => {
          row.forEach(control => {
            if (typeof control === 'object' && control !== null && 'name' in control) {
              if (control.name === 'x_axis_time_format') {
                timeFormatControl = control;
              }
            }
          });
        });
      });

      expect(timeFormatControl).toBeDefined();
      expect(timeFormatControl.config).toMatchObject({
        default: 'smart_date',
        disableStash: true,
        resetOnHide: false,
      });

      // Should have a description that includes D3 time format docs
      expect(timeFormatControl.config.description).toContain('D3');
    });
  });

  describe('Control panel structure for bar charts', () => {
    it('should have Chart Orientation section', () => {
      const config = controlPanel;
      
      const orientationSection = config.controlPanelSections.find(
        section => section.label === 'Chart Orientation'
      );
      
      expect(orientationSection).toBeDefined();
      expect(orientationSection?.expanded).toBe(true);
    });

    it('should have Chart Options section with X Axis controls', () => {
      const config = controlPanel;
      
      const chartOptionsSection = config.controlPanelSections.find(
        section => section.label === 'Chart Options'
      );
      
      expect(chartOptionsSection).toBeDefined();
      expect(chartOptionsSection?.expanded).toBe(true);

      // Should contain X Axis subsection header
      let hasXAxisSubsection = false;
      chartOptionsSection?.controlSetRows.forEach(row => {
        row.forEach(control => {
          if (typeof control === 'object' && 
              control !== null && 
              'props' in control && 
              control.props && 
              typeof control.props === 'object' &&
              'children' in control.props &&
              control.props.children === 'X Axis') {
            hasXAxisSubsection = true;
          }
        });
      });

      expect(hasXAxisSubsection).toBe(true);
    });

    it('should have proper form data overrides', () => {
      const config = controlPanel;
      
      expect(config.formDataOverrides).toBeDefined();
      expect(typeof config.formDataOverrides).toBe('function');

      // Test the form data override function
      const mockFormData = {
        metrics: ['test_metric'],
        groupby: ['test_column'],
        other_field: 'test'
      };

      const result = config.formDataOverrides(mockFormData);
      
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('groupby');
      expect(result).toHaveProperty('other_field', 'test');
    });
  });
});