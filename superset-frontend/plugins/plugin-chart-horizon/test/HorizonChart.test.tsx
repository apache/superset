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
import { render, screen } from 'spec/helpers/testing-library';
import HorizonChart from '../src/HorizonChart';

beforeAll(() => {
  // jsdom has no 2d context; HorizonRow guards on a null context
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const data = [
  { key: ['series', 'a'], values: [{ y: 1 }, { y: 2 }] },
  { key: ['series', 'b'], values: [{ y: 3 }, { y: 4 }] },
];

test('renders one row per data series with joined titles', () => {
  const { container } = render(<HorizonChart data={data} />);

  expect(container.querySelectorAll('.horizon-row')).toHaveLength(2);
  expect(screen.getByText('series, a')).toBeInTheDocument();
  expect(screen.getByText('series, b')).toBeInTheDocument();
});

test('applies the chart height to the container', () => {
  const { container } = render(<HorizonChart data={data} height={300} />);

  const chart = container.querySelector('.superset-legacy-chart-horizon');
  expect(chart).toHaveStyle({ height: '300px' });
});

test('renders nothing but the container for empty data', () => {
  const { container } = render(<HorizonChart data={[]} />);

  expect(container.querySelectorAll('.horizon-row')).toHaveLength(0);
});
