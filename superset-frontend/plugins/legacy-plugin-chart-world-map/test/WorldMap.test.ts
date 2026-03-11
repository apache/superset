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

import d3 from 'd3';
import { getNumberFormatter, ValueFormatter } from '@superset-ui/core';
import WorldMap from '../src/WorldMap';
import { ColorBy } from '../src/utils';

interface WorldMapDataEntry {
  country: string;
  code: string;
  latitude: number;
  longitude: number;
  name: string;
  m1: number;
  m2: number;
}

interface WorldMapProps {
  countryFieldtype: string;
  entity: string;
  data: WorldMapDataEntry[];
  width: number;
  height: number;
  maxBubbleSize: number;
  showBubbles: boolean;
  linearColorScheme: string;
  color: string;
  colorBy: ColorBy;
  colorScheme: string;
  sliceId: number;
  theme: Record<string, unknown>;
  onContextMenu: (
    x: number,
    y: number,
    payload: Record<string, unknown>,
  ) => void;
  setDataMask: (dataMask: Record<string, unknown>) => void;
  inContextMenu: boolean;
  filterState: { selectedValues?: string[] };
  emitCrossFilters: boolean;
  formatter: ValueFormatter;
}

type MouseEventHandler = (this: HTMLElement) => void;

interface MockD3Selection {
  attr: jest.Mock;
  style: jest.Mock;
  classed: jest.Mock;
  selectAll: jest.Mock;
}

// Mock Datamap
const mockBubbles = jest.fn();
const mockUpdateChoropleth = jest.fn();
const mockSvg = {
  selectAll: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  style: jest.fn().mockReturnThis(),
};

// Store the last Datamap config for assertions
let lastDatamapConfig: Record<string, unknown> | null = null;

jest.mock('datamaps/dist/datamaps.all.min', () =>
  jest.fn().mockImplementation(config => {
    // Store config for test assertions
    lastDatamapConfig = config;
    // Call the done callback immediately to simulate Datamap initialization
    if (config.done) {
      config.done({
        svg: mockSvg,
      });
    }
    return {
      bubbles: mockBubbles,
      updateChoropleth: mockUpdateChoropleth,
      svg: mockSvg,
    };
  }),
);

let container: HTMLElement;
const formatter = getNumberFormatter();

const baseProps: WorldMapProps = {
  data: [
    {
      country: 'USA',
      name: 'United States',
      m1: 100,
      m2: 200,
      code: 'US',
      latitude: 37.0902,
      longitude: -95.7129,
    },
    {
      country: 'CAN',
      name: 'Canada',
      m1: 50,
      m2: 100,
      code: 'CA',
      latitude: 56.1304,
      longitude: -106.3468,
    },
  ],
  width: 600,
  height: 400,
  maxBubbleSize: 25,
  showBubbles: false,
  linearColorScheme: 'schemeRdYlBu',
  color: '#61B0B7',
  colorBy: ColorBy.Country,
  colorScheme: 'supersetColors',
  sliceId: 123,
  theme: {
    colorBorder: '#e0e0e0',
    colorSplit: '#333',
    colorIcon: '#000',
    colorTextSecondary: '#666',
  },
  countryFieldtype: 'code',
  entity: 'country',
  onContextMenu: jest.fn(),
  setDataMask: jest.fn(),
  inContextMenu: false,
  filterState: { selectedValues: [] },
  emitCrossFilters: false,
  formatter,
};

beforeEach(() => {
  jest.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

test('sets up mouseover and mouseout handlers on countries', () => {
  WorldMap(container, baseProps);

  expect(mockSvg.selectAll).toHaveBeenCalledWith('.datamaps-subunit');
  const onCalls = mockSvg.on.mock.calls;

  // Find mouseover and mouseout handler registrations (namespaced events)
  const hasMouseover = onCalls.some(
    call => call[0] === 'mouseover.fillPreserve',
  );
  const hasMouseout = onCalls.some(call => call[0] === 'mouseout.fillPreserve');

  expect(hasMouseover).toBe(true);
  expect(hasMouseout).toBe(true);
});

test('stores original fill color on mouseover', () => {
  // Create a mock DOM element with d3 selection capabilities
  const mockElement = document.createElement('path');
  mockElement.setAttribute('class', 'datamaps-subunit USA');
  mockElement.style.fill = 'rgb(100, 150, 200)';
  container.appendChild(mockElement);

  let mouseoverHandler: MouseEventHandler | null = null;

  // Mock d3.select to return the mock element
  const mockD3Selection: MockD3Selection = {
    attr: jest.fn((attrName: string, value?: string) => {
      if (value !== undefined) {
        mockElement.setAttribute(attrName, value);
      } else {
        return mockElement.getAttribute(attrName);
      }
      return mockD3Selection;
    }),
    style: jest.fn((styleName: string, value?: string) => {
      if (value !== undefined) {
        mockElement.style[styleName as any] = value;
      } else {
        return mockElement.style[styleName as any];
      }
      return mockD3Selection;
    }),
    classed: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnValue({ remove: jest.fn() }),
  };

  jest.spyOn(d3 as any, 'select').mockReturnValue(mockD3Selection as any);

  // Capture the mouseover handler (namespaced event)
  mockSvg.on.mockImplementation((event: string, handler: MouseEventHandler) => {
    if (event === 'mouseover.fillPreserve') {
      mouseoverHandler = handler;
    }
    return mockSvg;
  });

  WorldMap(container, baseProps);

  // Simulate mouseover
  if (mouseoverHandler) {
    (mouseoverHandler as MouseEventHandler).call(mockElement);
  }

  // Verify that data-original-fill attribute was set
  expect(mockD3Selection.attr).toHaveBeenCalledWith(
    'data-original-fill',
    expect.any(String),
  );
});

test('restores original fill color on mouseout for country with data', () => {
  const mockElement = document.createElement('path');
  mockElement.setAttribute('class', 'datamaps-subunit USA');
  mockElement.style.fill = 'rgb(100, 150, 200)';
  mockElement.setAttribute('data-original-fill', 'rgb(100, 150, 200)');
  container.appendChild(mockElement);

  let mouseoutHandler: MouseEventHandler | null = null;

  const mockD3Selection: MockD3Selection = {
    attr: jest.fn((attrName: string, value?: string | null) => {
      if (value !== undefined) {
        if (value === null) {
          mockElement.removeAttribute(attrName);
        } else {
          mockElement.setAttribute(attrName, value);
        }
        return mockD3Selection;
      }
      return mockElement.getAttribute(attrName);
    }),
    style: jest.fn((styleName: string, value?: string) => {
      if (value !== undefined) {
        mockElement.style[styleName as any] = value;
      }
      return mockElement.style[styleName as any] || mockD3Selection;
    }),
    classed: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnValue({ remove: jest.fn() }),
  };

  jest.spyOn(d3 as any, 'select').mockReturnValue(mockD3Selection as any);

  // Capture the mouseout handler (namespaced event)
  mockSvg.on.mockImplementation((event: string, handler: MouseEventHandler) => {
    if (event === 'mouseout.fillPreserve') {
      mouseoutHandler = handler;
    }
    return mockSvg;
  });

  WorldMap(container, baseProps);

  // Simulate mouseout
  if (mouseoutHandler) {
    (mouseoutHandler as MouseEventHandler).call(mockElement);
  }

  // Verify that original fill was restored
  expect(mockD3Selection.style).toHaveBeenCalledWith(
    'fill',
    'rgb(100, 150, 200)',
  );
  expect(mockD3Selection.attr).toHaveBeenCalledWith('data-original-fill', null);
});

test('restores default fill color on mouseout for country with no data', () => {
  const mockElement = document.createElement('path');
  mockElement.setAttribute('class', 'datamaps-subunit XXX');
  mockElement.style.fill = '#e0e0e0'; // Default border color
  mockElement.setAttribute('data-original-fill', '#e0e0e0');
  container.appendChild(mockElement);

  let mouseoutHandler: MouseEventHandler | null = null;

  const mockD3Selection: MockD3Selection = {
    attr: jest.fn((attrName: string, value?: string | null) => {
      if (value !== undefined) {
        if (value === null) {
          mockElement.removeAttribute(attrName);
        } else {
          mockElement.setAttribute(attrName, value);
        }
        return mockD3Selection;
      }
      return mockElement.getAttribute(attrName);
    }),
    style: jest.fn((styleName: string, value?: string) => {
      if (value !== undefined) {
        mockElement.style[styleName as any] = value;
      }
      return mockElement.style[styleName as any] || mockD3Selection;
    }),
    classed: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnValue({ remove: jest.fn() }),
  };

  jest.spyOn(d3 as any, 'select').mockReturnValue(mockD3Selection as any);

  // Capture the mouseout handler (namespaced event)
  mockSvg.on.mockImplementation((event: string, handler: MouseEventHandler) => {
    if (event === 'mouseout.fillPreserve') {
      mouseoutHandler = handler;
    }
    return mockSvg;
  });

  WorldMap(container, baseProps);

  // Simulate mouseout
  if (mouseoutHandler) {
    (mouseoutHandler as MouseEventHandler).call(mockElement);
  }

  // Verify that default fill was restored (no-data color)
  expect(mockD3Selection.style).toHaveBeenCalledWith('fill', '#e0e0e0');
  expect(mockD3Selection.attr).toHaveBeenCalledWith('data-original-fill', null);
});

test('does not handle mouse events when inContextMenu is true', () => {
  const propsWithContextMenu = {
    ...baseProps,
    inContextMenu: true,
  };

  const mockElement = document.createElement('path');
  mockElement.setAttribute('class', 'datamaps-subunit USA');
  mockElement.style.fill = 'rgb(100, 150, 200)';
  container.appendChild(mockElement);

  let mouseoverHandler: MouseEventHandler | null = null;
  let mouseoutHandler: MouseEventHandler | null = null;

  const mockD3Selection: MockD3Selection = {
    attr: jest.fn(() => mockD3Selection),
    style: jest.fn(() => mockD3Selection),
    classed: jest.fn().mockReturnThis(),
    selectAll: jest.fn().mockReturnValue({ remove: jest.fn() }),
  };

  jest.spyOn(d3 as any, 'select').mockReturnValue(mockD3Selection as any);

  // Capture namespaced event handlers
  mockSvg.on.mockImplementation((event: string, handler: MouseEventHandler) => {
    if (event === 'mouseover.fillPreserve') {
      mouseoverHandler = handler;
    }
    if (event === 'mouseout.fillPreserve') {
      mouseoutHandler = handler;
    }
    return mockSvg;
  });

  WorldMap(container, propsWithContextMenu);

  // Simulate mouseover and mouseout
  if (mouseoverHandler) {
    (mouseoverHandler as MouseEventHandler).call(mockElement);
  }
  if (mouseoutHandler) {
    (mouseoutHandler as MouseEventHandler).call(mockElement);
  }

  // When inContextMenu is true, handlers should exit early without modifying anything
  // We verify this by checking that attr and style weren't called to change fill
  const attrCalls = mockD3Selection.attr.mock.calls;
  const fillChangeCalls = attrCalls.filter(
    (call: [string, unknown]) =>
      call[0] === 'data-original-fill' && call[1] !== undefined,
  );
  const styleCalls = mockD3Selection.style.mock.calls;
  const fillStyleChangeCalls = styleCalls.filter(
    (call: [string, unknown]) => call[0] === 'fill' && call[1] !== undefined,
  );
  // The handlers should return early, so no state changes
  expect(fillChangeCalls.length).toBe(0);
  expect(fillStyleChangeCalls.length).toBe(0);
});

test('does not throw error when onContextMenu is undefined', () => {
  const propsWithoutContextMenu = {
    ...baseProps,
    onContextMenu: undefined,
  };

  // Should not throw
  expect(() => {
    WorldMap(container, propsWithoutContextMenu as any);
  }).not.toThrow();
});

test('calls onContextMenu when provided and right-click occurs', () => {
  const mockOnContextMenu = jest.fn();
  const propsWithContextMenu = {
    ...baseProps,
    onContextMenu: mockOnContextMenu,
  };

  let contextMenuHandler: ((source: any) => void) | undefined;

  mockSvg.on.mockImplementation((event: string, handler: any) => {
    if (event === 'contextmenu') {
      contextMenuHandler = handler;
    }
    return mockSvg;
  });

  // Mock d3.event
  (d3 as any).event = {
    preventDefault: jest.fn(),
    clientX: 100,
    clientY: 200,
  };

  WorldMap(container, propsWithContextMenu);

  expect(contextMenuHandler).toBeDefined();
  contextMenuHandler!({ country: 'USA' });

  expect(mockOnContextMenu).toHaveBeenCalledWith(100, 200, expect.any(Object));
});

test('initializes Datamap with keyed object data for tooltip support', () => {
  WorldMap(container, baseProps);

  // Verify data is an object (not an array) keyed by country codes
  expect(Array.isArray(lastDatamapConfig?.data)).toBe(false);
  expect(typeof lastDatamapConfig?.data).toBe('object');

  const data = lastDatamapConfig?.data as Record<string, unknown>;

  // Verify the data is keyed by country code
  expect(data).toHaveProperty('USA');
  expect(data).toHaveProperty('CAN');

  // Verify the keyed data contains the expected properties for tooltips
  expect(data.USA).toMatchObject({
    country: 'USA',
    name: 'United States',
    m1: 100,
    m2: 200,
  });
  expect(data.CAN).toMatchObject({
    country: 'CAN',
    name: 'Canada',
    m1: 50,
    m2: 100,
  });
});

test('popupTemplate returns tooltip HTML when country data exists', () => {
  WorldMap(container, baseProps);

  const geographyConfig = lastDatamapConfig?.geographyConfig as Record<
    string,
    unknown
  >;
  const popupTemplate = geographyConfig?.popupTemplate as (
    geo: unknown,
    d: unknown,
  ) => string;

  const mockGeo = { properties: { name: 'United States' } };
  const mockCountryData = { name: 'United States', m1: 100 };

  const tooltipHtml = popupTemplate(mockGeo, mockCountryData);

  expect(tooltipHtml).toContain('United States');
  expect(tooltipHtml).toContain('hoverinfo');
});

test('popupTemplate handles null/undefined country data gracefully', () => {
  WorldMap(container, baseProps);

  const geographyConfig = lastDatamapConfig?.geographyConfig as Record<
    string,
    unknown
  >;
  const popupTemplate = geographyConfig?.popupTemplate as (
    geo: unknown,
    d: unknown,
  ) => string | undefined;

  const mockGeo = { properties: { name: 'Antarctica' } };

  // When hovering over a country with no data, 'd' will be undefined
  const tooltipHtml = popupTemplate(mockGeo, undefined);

  expect(tooltipHtml).toBeFalsy();
});
