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
import '@testing-library/jest-dom';
import { render, screen } from '@superset-ui/core/spec';
import userEvent from '@testing-library/user-event';
import { supersetTheme } from '@apache-superset/core/theme';
import ExpandButton from './ExpandButton';

test('label, expansion, keyboard and click isolation', async () => {
  const onToggle = jest.fn();
  const outer = jest.fn();
  const { rerender } = render(
    <div onClick={outer} role="presentation">
      <ExpandButton label="Session 1" expanded={false} onToggle={onToggle} />
    </div>,
  );
  const button = screen.getByRole('button', { name: 'Expand Session 1' });
  expect(screen.getByRole('img')).toHaveStyle({
    fontSize: `${supersetTheme.fontSizeSM}px`,
  });
  expect(button).toHaveClass(
    'ant-btn-color-default',
    'ant-btn-variant-text',
    'ant-btn-sm',
  );
  expect(button).not.toHaveClass('ant-btn-color-primary');
  expect(button).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(button);
  expect(onToggle).toHaveBeenCalledTimes(1);
  expect(outer).not.toHaveBeenCalled();
  button.focus();
  await userEvent.type(button, '{enter}', { skipClick: true });
  expect(onToggle).toHaveBeenCalledTimes(2);
  await userEvent.type(button, ' ', { skipClick: true });
  expect(onToggle).toHaveBeenCalledTimes(3);
  expect(outer).not.toHaveBeenCalled();
  rerender(<ExpandButton label="Session 1" expanded onToggle={onToggle} />);
  expect(
    screen.getByRole('button', { name: 'Collapse Session 1' }),
  ).toHaveAttribute('aria-expanded', 'true');
});
