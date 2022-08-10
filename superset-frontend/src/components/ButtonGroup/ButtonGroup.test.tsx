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
import Button from 'src/components/Button';
import ButtonGroup from '.';

test('renders 1 button', () => {
  render(
    <ButtonGroup>
      <Button>Button</Button>
    </ButtonGroup>,
  );
  expect(screen.getByRole('group')).toBeInTheDocument();
});

test('renders 3 buttons', () => {
  render(
    <ButtonGroup>
      <Button>Button</Button>
      <Button>Button</Button>
      <Button>Button</Button>
    </ButtonGroup>,
  );

  expect(screen.getByRole('group').children.length).toEqual(3);
});

test('renders with custom class', () => {
  const customClass = 'custom-class';
  render(
    <ButtonGroup className={customClass}>
      <Button>Button</Button>
    </ButtonGroup>,
  );

  expect(screen.getByRole('group')).toHaveClass(customClass);
});
