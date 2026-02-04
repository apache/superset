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

import Feature from 'ol/Feature';
import {
  clearTooltip,
  getTemplateProps,
  positionTooltip,
  renderTooltip,
  setTooltipInvisible,
  setTooltipVisible,
} from '../../../src/thematic/util/tooltipUtil';

describe('tooltipUtil', () => {
  describe('setTooltipInvisible', () => {
    it('sets the tooltip visibility to hidden', () => {
      const tooltip = document.createElement('div');
      setTooltipInvisible(tooltip);

      // eslint-disable-next-line jest-dom/prefer-to-have-style
      expect(tooltip.style.visibility).toBe('hidden');
    });
  });

  describe('setTooltipVisible', () => {
    it('sets the tooltip visibility to visible', () => {
      const tooltip = document.createElement('div');
      tooltip.style.visibility = 'hidden';
      setTooltipVisible(tooltip);

      // eslint-disable-next-line jest-dom/prefer-to-have-style
      expect(tooltip.style.visibility).toBe('visible');
    });
  });

  describe('clearTooltip', () => {
    it('clears the tooltip innerHTML', () => {
      const tooltip = document.createElement('div');
      tooltip.innerHTML = '<p>Test</p>';
      clearTooltip(tooltip);
      // eslint-disable-next-line jest-dom/prefer-empty
      expect(tooltip.innerHTML).toBe('');
    });
  });

  describe('renderTooltip', () => {
    it('renders the tooltip with the given template and props', () => {
      const tooltip = document.createElement('div');
      const template = '<p>{{name}}</p>';
      const props = { name: 'Test' };
      renderTooltip(template, props, tooltip);

      expect(tooltip.innerHTML).toBe('<p>Test</p>');
    });
  });

  describe('positionTooltip', () => {
    it('positions the tooltip correctly within viewport bounds', () => {
      const tooltip = document.createElement('div');
      tooltip.style.position = 'fixed';
      tooltip.style.width = '100px';
      tooltip.style.height = '50px';

      // Mock offsetWidth and offsetHeight
      Object.defineProperty(tooltip, 'offsetWidth', {
        configurable: true,
        value: 100,
      });
      Object.defineProperty(tooltip, 'offsetHeight', {
        configurable: true,
        value: 50,
      });

      const clientX = 950;
      const clientY = 580;
      const innerWidth = 1000;
      const innerHeight = 600;

      positionTooltip(tooltip, clientX, clientY, innerWidth, innerHeight);

      const expectedX = 840; // 950 - 100 - 10 (mouse x - tooltip width - offset)
      const expectedY = 530; // 580 - 50 (mouse y - tooltip height)

      expect(tooltip.offsetWidth).toBe(100);
      expect(tooltip.offsetHeight).toBe(50);
      expect(parseInt(tooltip.style.left, 10)).toBe(expectedX);
      expect(parseInt(tooltip.style.top, 10)).toBe(expectedY);
    });
  });

  describe('getTemplateProps', () => {
    it('returns the feature properties excluding ignored properties', () => {
      const data = {
        name: 'Test',
        value: 42,
        geometry: 'geomData',
      };
      const columns = [
        { column_name: 'name' },
        { column_name: 'value' },
        { column_name: 'geometry' },
      ];
      const feature = {
        getProperties: () => data,
      } as unknown as Feature;

      const ignoredProps = ['geometry'];
      const props = getTemplateProps(feature, ignoredProps, columns);

      expect(props).toEqual({ name: 'Test', value: 42 });
    });

    it('resolves the verbose names for feature properties', () => {
      const data = {
        name: 'Test',
        value: 42,
        geometry: 'geomData',
      };
      const columns = [
        { column_name: 'name', verbose_name: 'Full Name' },
        { column_name: 'value' },
      ];
      const feature = {
        getProperties: () => data,
      } as unknown as Feature;

      const ignoredProps: string[] = [];
      const props = getTemplateProps(feature, ignoredProps, columns);
      const propKeys = Object.keys(props);

      expect(propKeys).toEqual(expect.arrayContaining(['Full Name', 'value']));
    });
  });
});
