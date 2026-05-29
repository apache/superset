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
import PreviewBanner from '../components/PreviewBanner';
import { VersionHistoryProvider } from '../context/VersionHistoryContext';
import { DRAWER_WIDTH } from '../components/VersionHistoryPanel';

function renderBanner(props: {
  entityType: 'chart' | 'dashboard';
  onOpenAsNew?: () => void;
  initialPanelOpen?: boolean;
}) {
  // VersionHistoryProvider derives ``isPanelOpen`` from the URL on first
  // render, so we pre-set a marker that triggers it. Easier than mocking
  // the context: just rely on the no-op callbacks since we only assert
  // the rendered DOM.
  return render(
    <VersionHistoryProvider>
      <PreviewBanner
        entityType={props.entityType}
        summary="Changed dashboard title"
        date="5/29/2026"
        onRestore={() => undefined}
        onExit={() => undefined}
        onOpenAsNew={props.onOpenAsNew}
      />
    </VersionHistoryProvider>,
  );
}

test('PreviewBanner renders entity-aware "Open as new chart" button', () => {
  renderBanner({ entityType: 'chart', onOpenAsNew: () => undefined });
  expect(screen.getByTestId('version-preview-open-as-new')).toHaveTextContent(
    'Open as new chart',
  );
});

test('PreviewBanner renders entity-aware "Open as new dashboard" button', () => {
  renderBanner({ entityType: 'dashboard', onOpenAsNew: () => undefined });
  expect(screen.getByTestId('version-preview-open-as-new')).toHaveTextContent(
    'Open as new dashboard',
  );
});

test('PreviewBanner hides "Open as new" when onOpenAsNew is not provided', () => {
  renderBanner({ entityType: 'chart' });
  expect(
    screen.queryByTestId('version-preview-open-as-new'),
  ).not.toBeInTheDocument();
});

test('PreviewBanner exit button shows "Close preview" copy', () => {
  renderBanner({ entityType: 'chart' });
  expect(screen.getByTestId('version-preview-exit')).toHaveTextContent(
    'Close preview',
  );
});

test('PreviewBanner flags itself as panel-open when the drawer is open', () => {
  // VersionHistoryProvider opens the panel automatically if the URL
  // carries a ``version_uuid`` marker (the case while previewing).
  const url = new URL(window.location.href);
  url.searchParams.set('version_uuid', '11111111-2222-3333-4444-555555555555');
  window.history.replaceState(window.history.state, '', url.toString());
  try {
    renderBanner({ entityType: 'chart' });
    const banner = screen.getByTestId('version-preview-banner');
    // The actual padding is applied via Emotion's css prop which jsdom
    // can't compute. The data attribute is the structural invariant we
    // can pin: when the drawer is open the banner reserves space for
    // it. The DRAWER_WIDTH export ties the two paddings together at
    // compile time.
    expect(banner).toHaveAttribute('data-test-panel-open', 'true');
    expect(DRAWER_WIDTH).toBeGreaterThan(0);
  } finally {
    const cleanup = new URL(window.location.href);
    cleanup.searchParams.delete('version_uuid');
    window.history.replaceState(window.history.state, '', cleanup.toString());
  }
});

test('PreviewBanner flags itself as panel-closed when the drawer is closed', () => {
  renderBanner({ entityType: 'chart' });
  const banner = screen.getByTestId('version-preview-banner');
  expect(banner).toHaveAttribute('data-test-panel-open', 'false');
});
