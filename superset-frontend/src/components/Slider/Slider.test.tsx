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
<<<<<<<< HEAD:superset-frontend/plugins/plugin-aven-ab-chart/test/index.test.ts

import { AvenABChartPlugin } from '../src';

/**
 * The example tests in this file act as a starting point, and
 * we encourage you to build more. These tests check that the
 * plugin loads properly, and focus on `transformProps`
 * to ake sure that data, controls, and props are all
 * treated correctly (e.g. formData from plugin controls
 * properly transform the data and/or any resulting props).
 */
describe('plugin-aven-ab-chart', () => {
  it('exists', () => {
    expect(AvenABChartPlugin).toBeDefined();
  });
========
import { render, screen } from 'spec/helpers/testing-library';
import Slider from '.';

const mockedProps = {
  defaultValue: 90,
  tooltip: {
    open: true,
  },
};

test('should render', () => {
  const { container } = render(<Slider {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render with default value on tooltip', () => {
  render(<Slider {...mockedProps} />);
  expect(
    screen.getAllByText(`${mockedProps.defaultValue}`)[0],
  ).toBeInTheDocument();
>>>>>>>> 4.1.1:superset-frontend/src/components/Slider/Slider.test.tsx
});
