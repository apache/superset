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
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import ControlSetRow from 'src/explore/components/ControlRow';

const MockControl = (props: {
  children: React.ReactElement;
  type?: string;
  isVisible?: boolean;
}) => <div>{props.children}</div>;
describe('ControlSetRow', () => {
  it('renders a single row with one element', () => {
    render(<ControlSetRow controls={[<p>My Control 1</p>]} />);
    expect(screen.getAllByText('My Control 1').length).toBe(1);
  });
  it('renders a single row with two elements', () => {
    render(
      <ControlSetRow controls={[<p>My Control 1</p>, <p>My Control 2</p>]} />,
    );
    expect(screen.getAllByText(/My Control/)).toHaveLength(2);
  });

  it('renders a single row with one elements if is HiddenControl', () => {
    render(
      <ControlSetRow
        controls={[
          <p>My Control 1</p>,
          <MockControl type="HiddenControl">
            <p>My Control 2</p>
          </MockControl>,
        ]}
      />,
    );
    expect(screen.getAllByText(/My Control/)).toHaveLength(2);
  });

  it('renders a single row with one elements if is invisible', () => {
    render(
      <ControlSetRow
        controls={[
          <p>My Control 1</p>,
          <MockControl isVisible={false}>
            <p>My Control 2</p>
          </MockControl>,
        ]}
      />,
    );
    expect(screen.getAllByText(/My Control/)).toHaveLength(2);
  });
});
