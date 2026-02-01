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
import WorldMap from '../src/WorldMap';

// Mock Datamap
const mockBubbles = jest.fn();
const mockUpdateChoropleth = jest.fn();
const mockSvg = {
  selectAll: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  style: jest.fn().mockReturnThis(),
};

jest.mock('datamaps/dist/datamaps.all.min', () => {
  return jest.fn().mockImplementation((config) => {
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
  });
});

describe('WorldMap hover behavior', () => {
  let container: HTMLElement;
  const mockFormatter = jest.fn((val) => String(val));

  const baseProps = {
    data: [
      { country: 'USA', name: 'United States', m1: 100, m2: 200, code: 'US' },
      { country: 'CAN', name: 'Canada', m1: 50, m2: 100, code: 'CA' },
    ],
    width: 600,
    height: 400,
    maxBubbleSize: 25,
    showBubbles: false,
    linearColorScheme: 'schemeRdYlBu',
    color: '#61B0B7',
    colorBy: 'country',
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
    formatter: mockFormatter,
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

    // Find mouseover and mouseout handler registrations
    const hasMouseover = onCalls.some(call => call[0] === 'mouseover');
    const hasMouseout = onCalls.some(call => call[0] === 'mouseout');

    expect(hasMouseover).toBe(true);
    expect(hasMouseout).toBe(true);
  });

  test('stores original fill color on mouseover', () => {
    // Create a mock DOM element with d3 selection capabilities
    const mockElement = document.createElement('path');
    mockElement.setAttribute('class', 'datamaps-subunit USA');
    mockElement.style.fill = 'rgb(100, 150, 200)';
    container.appendChild(mockElement);

    let mouseoverHandler: ((this: HTMLElement) => void) | null = null;

    // Mock d3.select to return the mock element
    const mockD3Selection = {
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
    };

    jest.spyOn(d3, 'select').mockReturnValue(mockD3Selection as any);

    // Capture the mouseover handler
    mockSvg.on.mockImplementation((event: string, handler: any) => {
      if (event === 'mouseover') {
        mouseoverHandler = handler;
      }
      return mockSvg;
    });

    WorldMap(container, baseProps);

    // Simulate mouseover
    if (mouseoverHandler) {
      mouseoverHandler.call(mockElement);
    }

    // Verify that data-original-fill attribute was set
    expect(mockD3Selection.attr).toHaveBeenCalledWith('data-original-fill', expect.any(String));
  });

  test('restores original fill color on mouseout for country with data', () => {
    const mockElement = document.createElement('path');
    mockElement.setAttribute('class', 'datamaps-subunit USA');
    mockElement.style.fill = 'rgb(100, 150, 200)';
    mockElement.setAttribute('data-original-fill', 'rgb(100, 150, 200)');
    container.appendChild(mockElement);

    let mouseoutHandler: ((this: HTMLElement) => void) | null = null;

    const mockD3Selection = {
      attr: jest.fn((attrName: string, value?: string | null) => {
        if (value !== undefined) {
          if (value === null) {
            mockElement.removeAttribute(attrName);
          } else {
            mockElement.setAttribute(attrName, value);
          }
        }
        return mockElement.getAttribute(attrName) || mockD3Selection;
      }),
      style: jest.fn((styleName: string, value?: string) => {
        if (value !== undefined) {
          mockElement.style[styleName as any] = value;
        }
        return mockElement.style[styleName as any] || mockD3Selection;
      }),
    };

    jest.spyOn(d3, 'select').mockReturnValue(mockD3Selection as any);

    // Capture the mouseout handler
    mockSvg.on.mockImplementation((event: string, handler: any) => {
      if (event === 'mouseout') {
        mouseoutHandler = handler;
      }
      return mockSvg;
    });

    WorldMap(container, baseProps);

    // Simulate mouseout
    if (mouseoutHandler) {
      mouseoutHandler.call(mockElement);
    }

    // Verify that original fill was restored
    expect(mockD3Selection.style).toHaveBeenCalledWith('fill', 'rgb(100, 150, 200)');
    expect(mockD3Selection.attr).toHaveBeenCalledWith('data-original-fill', null);
  });

  test('restores default fill color on mouseout for country with no data', () => {
    const mockElement = document.createElement('path');
    mockElement.setAttribute('class', 'datamaps-subunit XXX');
    mockElement.style.fill = '#e0e0e0'; // Default border color
    mockElement.setAttribute('data-original-fill', '#e0e0e0');
    container.appendChild(mockElement);

    let mouseoutHandler: ((this: HTMLElement) => void) | null = null;

    const mockD3Selection = {
      attr: jest.fn((attrName: string, value?: string | null) => {
        if (value !== undefined) {
          if (value === null) {
            mockElement.removeAttribute(attrName);
          } else {
            mockElement.setAttribute(attrName, value);
          }
        }
        return mockElement.getAttribute(attrName) || mockD3Selection;
      }),
      style: jest.fn((styleName: string, value?: string) => {
        if (value !== undefined) {
          mockElement.style[styleName as any] = value;
        }
        return mockElement.style[styleName as any] || mockD3Selection;
      }),
    };

    jest.spyOn(d3, 'select').mockReturnValue(mockD3Selection as any);

    mockSvg.on.mockImplementation((event: string, handler: any) => {
      if (event === 'mouseout') {
        mouseoutHandler = handler;
      }
      return mockSvg;
    });

    WorldMap(container, baseProps);

    // Simulate mouseout
    if (mouseoutHandler) {
      mouseoutHandler.call(mockElement);
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

    let mouseoverHandler: ((this: HTMLElement) => void) | null = null;
    let mouseoutHandler: ((this: HTMLElement) => void) | null = null;

    const mockD3Selection = {
      attr: jest.fn(() => mockD3Selection),
      style: jest.fn(() => mockD3Selection),
    };

    jest.spyOn(d3, 'select').mockReturnValue(mockD3Selection as any);

    mockSvg.on.mockImplementation((event: string, handler: any) => {
      if (event === 'mouseover') {
        mouseoverHandler = handler;
      }
      if (event === 'mouseout') {
        mouseoutHandler = handler;
      }
      return mockSvg;
    });

    WorldMap(container, propsWithContextMenu);

    // Simulate mouseover and mouseout
    if (mouseoverHandler) {
      mouseoverHandler.call(mockElement);
    }
    if (mouseoutHandler) {
      mouseoutHandler.call(mockElement);
    }

    // When inContextMenu is true, handlers should exit early without modifying anything
    // We verify this by checking that attr and style weren't called to change fill
    const attrCalls = mockD3Selection.attr.mock.calls;
    const fillChangeCalls = attrCalls.filter(call => 
      call[0] === 'data-original-fill' && call[1] !== undefined
    );
    
    // The handlers should return early, so no state changes
    expect(fillChangeCalls.length).toBe(0);
  });
});
