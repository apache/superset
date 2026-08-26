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
import { render, screen } from 'spec/helpers/testing-library';
import { registerLeftBarView, resetLeftBarViews } from './leftBarViews';
import {
  LeftBarViewPanelHost,
  LeftBarViewTriggerHost,
} from './LeftBarViewHost';

beforeEach(() => {
  resetLeftBarViews();
});

test('trigger host renders nothing for an unregistered id', () => {
  render(<LeftBarViewTriggerHost viewId="unknown" />);

  expect(
    screen.queryByTestId('left-bar-view-trigger-unknown'),
  ).not.toBeInTheDocument();
});

test('trigger host renders the registered trigger', () => {
  registerLeftBarView(
    { id: 'ext.a', name: 'A' },
    () => <button type="button">Trigger A</button>,
    () => <div>Panel A</div>,
  );

  render(<LeftBarViewTriggerHost viewId="ext.a" />);

  expect(screen.getByText('Trigger A')).toBeInTheDocument();
});

test('panel host renders ExtensionPlaceholder for an unregistered id', () => {
  render(<LeftBarViewPanelHost viewId="unknown" />);

  expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
});

test('panel host renders the registered panel', () => {
  registerLeftBarView(
    { id: 'ext.a', name: 'A' },
    () => <span>Trigger A</span>,
    () => <div>Panel A</div>,
  );

  render(<LeftBarViewPanelHost viewId="ext.a" />);

  expect(screen.getByText('Panel A')).toBeInTheDocument();
});

test('a crashing panel does not take down its trigger', () => {
  registerLeftBarView(
    { id: 'ext.a', name: 'A' },
    () => <button type="button">Trigger A</button>,
    () => {
      throw new Error('panel blew up');
    },
  );

  render(
    <>
      <LeftBarViewTriggerHost viewId="ext.a" />
      <LeftBarViewPanelHost viewId="ext.a" />
    </>,
  );

  expect(screen.getByText('Trigger A')).toBeInTheDocument();
  // The boundary contains the crash silently — the panel slot renders empty
  // rather than an error card, but the wrapper stays in the DOM.
  expect(screen.getByTestId('left-bar-view-panel-ext.a')).toBeInTheDocument();
});

test('a crashing trigger does not take down a sibling trigger', () => {
  registerLeftBarView(
    { id: 'ext.a', name: 'A' },
    () => {
      throw new Error('trigger blew up');
    },
    () => <div>Panel A</div>,
  );
  registerLeftBarView(
    { id: 'ext.b', name: 'B' },
    () => <button type="button">Trigger B</button>,
    () => <div>Panel B</div>,
  );

  expect(() =>
    render(
      <>
        <LeftBarViewTriggerHost viewId="ext.a" />
        <LeftBarViewTriggerHost viewId="ext.b" />
      </>,
    ),
  ).not.toThrow();

  expect(screen.getByText('Trigger B')).toBeInTheDocument();
});

test('a crashing panel does not take down a sibling panel', () => {
  registerLeftBarView(
    { id: 'ext.a', name: 'A' },
    () => <span>Trigger A</span>,
    () => {
      throw new Error('panel blew up');
    },
  );
  registerLeftBarView(
    { id: 'ext.b', name: 'B' },
    () => <span>Trigger B</span>,
    () => <div>Panel B</div>,
  );

  render(
    <>
      <LeftBarViewPanelHost viewId="ext.a" />
      <LeftBarViewPanelHost viewId="ext.b" />
    </>,
  );

  expect(screen.getByText('Panel B')).toBeInTheDocument();
});
