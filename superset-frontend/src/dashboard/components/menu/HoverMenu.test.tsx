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
import { render, screen, userEvent } from 'spec/helpers/testing-library';

import HoverMenu from 'src/dashboard/components/menu/HoverMenu';

test('should render a div.hover-menu', () => {
  const { container } = render(<HoverMenu />);
  expect(container.querySelector('.hover-menu')).toBeInTheDocument();
});

test('should call onHover when mouse enters and leaves', () => {
  const onHover = jest.fn();
  render(<HoverMenu onHover={onHover} />);

  const hoverMenu = screen.getByTestId('hover-menu');

  userEvent.hover(hoverMenu);
  expect(onHover).toHaveBeenCalledWith({ isHovered: true });

  userEvent.unhover(hoverMenu);
  expect(onHover).toHaveBeenCalledWith({ isHovered: false });
});
