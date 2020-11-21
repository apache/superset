/**
 * @jest-environment jsdom
 */
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
import { render, sleep, waitFor } from 'spec/helpers/testing-library';
import Timer from 'src/components/Timer';
import { now } from 'src/modules/dates';

function parseTime(text?: string | null) {
  return !!text && Number(text.replace(/:/g, ''));
}

describe('Timer', () => {
  const mockProps = {
    startTime: now(),
    endTime: undefined,
    isRunning: true,
    status: 'warning',
  };

  it('should render correctly', async () => {
    const screen = render(<Timer {...mockProps} />);
    const node = screen.getByRole('timer');
    let text = node.textContent || '';
    expect(node).toBeInTheDocument();
    expect(node).toHaveClass('label-warning');
    expect(node).toHaveTextContent('00:00:00.00');
    // should start running
    await waitFor(() => {
      expect(parseTime(screen.getByRole('timer')?.textContent)).toBeGreaterThan(
        0.2,
      );
    });
    text = node.textContent || '';

    // should stop
    screen.rerender(<Timer {...mockProps} isRunning={false} />);
    // the same node should still be in DOM and the content should not change
    expect(screen.getByRole('timer')).toBe(node);
    expect(node).toHaveTextContent(text);

    // the timestamp should not change even after while
    await sleep(100);
    expect(screen.getByRole('timer')).toBe(node);
    expect(node).toHaveTextContent(text);

    // should continue and start from stopped time
    screen.rerender(<Timer {...mockProps} isRunning />);
    expect(screen.getByRole('timer')).toBe(node);
    expect(node).toHaveTextContent(text);

    await waitFor(() => {
      expect(screen.getByRole('timer')).toBe(node);
      expect(parseTime(node.textContent)).toBeGreaterThan(0.3);
    });

    // should restart from start
    screen.rerender(<Timer {...mockProps} startTime={now()} />);
    await waitFor(() => {
      expect(parseTime(node.textContent)).toBeLessThan(0.1);
    });
    // should continue to run
    await waitFor(() => {
      expect(parseTime(node.textContent)).toBeGreaterThan(0.3);
    });
  });
});
