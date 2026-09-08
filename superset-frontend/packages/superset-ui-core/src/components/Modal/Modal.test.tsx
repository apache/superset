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

import { useState } from 'react';
import { fireEvent, render, screen } from '@superset-ui/core/spec';
import { Input } from '../Input';
import { Modal } from './Modal';

const drag = (
  target: Element,
  from: [number, number],
  to: [number, number],
) => {
  fireEvent.mouseDown(target, { clientX: from[0], clientY: from[1] });
  fireEvent.mouseMove(document, { clientX: to[0], clientY: to[1] });
  fireEvent.mouseUp(document);
};

const isDragged = () => !!document.querySelector('.react-draggable-dragged');

describe('Modal draggable', () => {
  test('dragging from the title bar moves the modal', () => {
    render(
      <Modal show onHide={() => {}} title="Edit Dataset" draggable name="test">
        <Input data-test="field" defaultValue="value" />
      </Modal>,
    );

    const trigger = document.querySelector('.draggable-trigger') as HTMLElement;
    drag(trigger, [100, 50], [150, 90]);

    expect(isDragged()).toBe(true);
  });

  test('dragging inside modal content does not move the modal', () => {
    render(
      <Modal show onHide={() => {}} title="Edit Dataset" draggable name="test">
        <Input data-test="field" defaultValue="first_view_event" />
      </Modal>,
    );

    const input = screen.getByTestId('field');
    drag(input, [200, 400], [260, 430]);

    expect(isDragged()).toBe(false);
  });

  test('dragging inside modal content does not move the modal, even after an unrelated re-render while the title was hovered', () => {
    // Regression test: the title bar used to gate dragging with a
    // hover-tracked boolean (mouseover/mouseout on `.draggable-trigger`)
    // instead of react-draggable's own `handle` prop. Because the title
    // element was defined as an inline component recreated on every
    // render, any unrelated state change while the cursor was over the
    // title (e.g. typing in any field) force-remounted it without a real
    // mouseout ever firing, leaving dragging permanently enabled -- so
    // selecting text anywhere in the modal dragged the whole modal
    // instead.
    function Harness() {
      const [tick, setTick] = useState(0);
      return (
        <Modal
          show
          onHide={() => {}}
          title="Edit Dataset"
          draggable
          name="test"
        >
          <button
            type="button"
            data-test="rerender"
            onClick={() => setTick(tick + 1)}
          >
            rerender
          </button>
          <Input data-test="field" defaultValue="first_view_event" />
        </Modal>
      );
    }

    render(<Harness />);

    const trigger = document.querySelector('.draggable-trigger') as HTMLElement;
    fireEvent.mouseOver(trigger);
    fireEvent.click(screen.getByTestId('rerender'));

    const input = screen.getByTestId('field');
    drag(input, [200, 400], [260, 430]);

    expect(isDragged()).toBe(false);
  });

  test('dragging is disabled entirely when draggable is not set', () => {
    render(
      <Modal show onHide={() => {}} title="Edit Dataset" name="test">
        <Input data-test="field" defaultValue="value" />
      </Modal>,
    );

    expect(document.querySelector('.draggable-trigger')).toBeNull();
  });

  test('draggableConfig cannot re-enable dragging on a non-draggable modal', () => {
    render(
      <Modal
        show
        onHide={() => {}}
        title="Edit Dataset"
        name="test"
        draggableConfig={{ disabled: false }}
      >
        <Input data-test="field" defaultValue="value" />
      </Modal>,
    );

    expect(document.querySelector('.draggable-trigger')).toBeNull();
  });

  test('draggableConfig can still opt a draggable modal out of dragging', () => {
    render(
      <Modal
        show
        onHide={() => {}}
        title="Edit Dataset"
        draggable
        name="test"
        draggableConfig={{ disabled: true }}
      >
        <Input data-test="field" defaultValue="value" />
      </Modal>,
    );

    const trigger = document.querySelector('.draggable-trigger') as HTMLElement;
    drag(trigger, [100, 50], [150, 90]);

    expect(isDragged()).toBe(false);
  });
});
