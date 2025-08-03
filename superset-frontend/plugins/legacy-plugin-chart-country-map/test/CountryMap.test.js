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

import '@testing-library/jest-dom';
import CountryMap from '../src/CountryMap';
import '../src/CountryMap.css';

describe('CountryMap', () => {
  let container;
  let mockProps;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    mockProps = {
      data: [
        { country_id: 'USA', metric: 100 },
        { country_id: 'CAN', metric: 50 },
      ],
      width: 800,
      height: 600,
      country: 'usa',
      linearColorScheme: 'greenBlue',
      numberFormat: '.3s',
      colorScheme: null,
      sliceId: 1,
    };
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should create the necessary DOM elements', () => {
    CountryMap(container, mockProps);

    // Check if main container has the correct class
    expect(container).toHaveClass('superset-legacy-chart-country-map');

    // Check if SVG is created
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute('width', '800');
    expect(svg).toHaveAttribute('height', '600');

    // Check if tooltip div is created
    const tooltip = container.querySelector('.tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip).toHaveStyle({ opacity: '0' });
  });

  it('should create map layers', () => {
    CountryMap(container, mockProps);

    // Check if map layer exists
    const mapLayer = container.querySelector('.map-layer');
    expect(mapLayer).toBeTruthy();

    // Check if text layer exists
    const textLayer = container.querySelector('.text-layer');
    expect(textLayer).toBeTruthy();
  });

  it('should create tooltip with proper attributes', () => {
    CountryMap(container, mockProps);

    const tooltip = container.querySelector('.tooltip');
    expect(tooltip).toBeTruthy();

    // Check if tooltip has the correct class
    expect(tooltip).toHaveClass('tooltip');
    
    // Check if tooltip has opacity 0 initially
    expect(tooltip).toHaveStyle({ opacity: 0 });
  });
});
