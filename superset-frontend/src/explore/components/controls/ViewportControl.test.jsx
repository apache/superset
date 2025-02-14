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
import ViewportControl from 'src/explore/components/controls/ViewportControl';
import { render, screen, userEvent } from 'spec/helpers/testing-library';

const defaultProps = {
  value: {
    longitude: 6.85236157047845,
    latitude: 31.222656842808707,
    zoom: 1,
    bearing: 0,
    pitch: 0,
  },
  name: 'foo',
  label: 'bar',
};
const renderedCoordinate = '6° 51\' 8.50" | 31° 13\' 21.56"';

describe('ViewportControl', () => {
  beforeEach(() => {
    render(<ViewportControl {...defaultProps} />);
  });

  it('renders a OverlayTrigger if clicked', () => {
    expect(screen.getByTestId('foo-header')).toBeInTheDocument(); // Presence of ControlHeader
    userEvent.click(screen.getByText(renderedCoordinate));
    expect(screen.getByText('Viewport')).toBeInTheDocument(); // Presence of Popover
  });

  it('renders a Popover with 5 TextControl if clicked', () => {
    userEvent.click(screen.getByText(renderedCoordinate));
    expect(screen.queryAllByTestId('inline-name')).toHaveLength(5);
  });

  it('renders a summary in the label', () => {
    expect(screen.getByText(renderedCoordinate)).toBeInTheDocument();
  });
});
