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

/**
 * The explore row has to fit the window, because nothing lets the reader
 * past it if it does not.
 *
 * `#app` hides its overflow and this row has no horizontal scroll, so
 * anything the row pushes past the window edge is simply gone: measured at
 * a 1024px window the row was 1132px wide and took a contributed banner's own
 * controls with it, and at 1280px with a panel docked it was 1452px and cut
 * 172px off the panel. Both came from the chart column's 512px being a hard
 * floor the row could not go under.
 *
 * jsdom does no layout, so these pin the rule that decides it rather than
 * the pixels it produces -- which column gives way, and which does not. The
 * widths themselves are measured in a browser.
 */
import { render } from 'spec/helpers/testing-library';
import {
  ExplorePanelContainer,
  DockedPanelHost,
} from 'src/explore/components/ExploreViewContainer';

test('the chart column gives way rather than pushing the row off screen', () => {
  const { container } = render(
    <ExplorePanelContainer>
      <div className="main-explore-content" />
    </ExplorePanelContainer>,
  );

  // Nothing may stop this column shrinking: a flex item refuses to go below
  // its automatic minimum unless told, and that refusal is what overflowed.
  expect(container.firstChild).toHaveStyleRule('min-width', '0', {
    target: /main-explore-content/,
  });

  // 512px stays, as what the column asks for when there is room, which is
  // why a wide window still lays out exactly as it did.
  expect(container.firstChild).toHaveStyleRule('flex', '1 1 512px', {
    target: /main-explore-content/,
  });
});

test('a docked panel keeps its width instead of squeezing its own contents', () => {
  const { container } = render(<DockedPanelHost />);

  // The pairing: the panel holds 320px and the chart column beside it is
  // what gives. A panel allowed to shrink overflows its own contents, which
  // is the failure the docked slot exists to avoid.
  expect(container.firstChild).toHaveStyleRule('flex-shrink', '0');
});

test('an empty dock takes up no room at all', () => {
  const { container } = render(<DockedPanelHost />);

  // Explore renders the slot whether or not anything portals into it, so an
  // occupied-looking empty slot would narrow the chart on every page.
  expect(container.firstChild).toHaveStyleRule('display', 'none', {
    target: ':empty',
  });
});
