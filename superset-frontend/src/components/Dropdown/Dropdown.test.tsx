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

import { render, fireEvent, screen } from 'spec/helpers/testing-library';
import { NoAnimationDropdown } from './index'; // adjust the import path as needed

const props = {
  overlay: <div>Test Overlay</div>,
};
describe('NoAnimationDropdown', () => {
  it('requires children', () => {
    expect(() => {
      // @ts-ignore need to test the error case
      render(<NoAnimationDropdown {...props} />);
    }).toThrow();
  });

  it('renders its children', () => {
    render(
      <NoAnimationDropdown {...props}>
        <button type="button">Test Button</button>
      </NoAnimationDropdown>,
    );
    expect(screen.getByText('Test Button')).toBeInTheDocument();
  });

  it('calls onBlur when it loses focus', () => {
    const onBlur = jest.fn();
    render(
      <NoAnimationDropdown {...props} onBlur={onBlur}>
        <button type="button">Test Button</button>
      </NoAnimationDropdown>,
    );
    fireEvent.blur(screen.getByText('Test Button'));
    expect(onBlur).toHaveBeenCalled();
  });

  it('calls onKeyDown when a key is pressed', () => {
    const onKeyDown = jest.fn();
    render(
      <NoAnimationDropdown {...props} onKeyDown={onKeyDown}>
        <button type="button">Test Button</button>
      </NoAnimationDropdown>,
    );
    fireEvent.keyDown(screen.getByText('Test Button'));
    expect(onKeyDown).toHaveBeenCalled();
  });
});
