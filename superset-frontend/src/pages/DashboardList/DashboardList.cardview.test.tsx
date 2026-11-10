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
import fetchMock from 'fetch-mock';
import {
  fireEvent,
  screen,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import {
  mockDashboards,
  mockHandleResourceExport,
  renderDashboardList,
  setupMocks,
  getLatestDashboardApiCall,
} from './DashboardList.testHelpers';

jest.setTimeout(30000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('src/utils/export', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_write', 'Dashboard'],
      ['can_export', 'Dashboard'],
    ],
  },
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DashboardList Card View Tests', () => {
  beforeEach(() => {
    setupMocks();

    // Enable card view as default
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation(
      (feature: string) => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW',
    );
  });

  afterEach(() => fetchMock.clearHistory().removeRoutes());

  test('renders cards instead of table', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');

    // Verify no table in card view
    expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();

    // Verify card view toggle is active
    const cardViewToggle = screen.getByRole('img', { name: 'appstore' });
    const cardViewButton = cardViewToggle.closest('button');
    expect(cardViewButton).toHaveClass('active');
  });

  test('switches from card view to list view', async () => {
    renderDashboardList(mockUser);
    await screen.findByTestId('dashboard-list-view');

    expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();

    // Switch to list view
    const listViewToggle = screen.getByRole('img', {
      name: 'unordered-list',
    });
    const listViewButton = listViewToggle.closest('button');
    expect(listViewButton).not.toBeNull();
    fireEvent.click(listViewButton!);

    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });
  });

  test('displays dashboard data correctly in cards', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');

    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Verify favorite stars exist (one per dashboard)
    const favoriteStars = screen.getAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(mockDashboards.length);

    // Verify action menu exists (more button for each card)
    const moreButtons = screen.getAllByLabelText('more');
    expect(moreButtons).toHaveLength(mockDashboards.length);

    // Verify menu items appear on click
    fireEvent.click(moreButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  test('renders sort dropdown in card view', async () => {
    renderDashboardList(mockUser);
    await screen.findByTestId('dashboard-list-view');

    await waitFor(() => {
      expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();
    });

    const sortFilter = screen.getByTestId('card-sort-select');
    expect(sortFilter).toBeInTheDocument();
    expect(sortFilter).toBeVisible();
  });

  test('selecting a sort option triggers new API call', async () => {
    renderDashboardList(mockUser);
    await screen.findByTestId('dashboard-list-view');

    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Find the sort select by its testId, then the pill button within it
    const sortContainer = screen.getByTestId('card-sort-select');
    // eslint-disable-next-line testing-library/no-node-access
    const sortPill = sortContainer.querySelector(
      '[data-test="compact-filter-pill"]',
    ) as HTMLElement;
    await userEvent.click(sortPill);

    // Select "Alphabetical" from the dropdown
    const alphabeticalOption = await screen.findByText('Alphabetical');
    await userEvent.click(alphabeticalOption);

    await waitFor(() => {
      const latest = getLatestDashboardApiCall();
      expect(latest).not.toBeNull();
      expect(latest!.query).toMatchObject({
        order_column: 'dashboard_title',
        order_direction: 'asc',
      });
    });
  });

  test('can bulk deselect all dashboards', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');
    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Select first card
    const firstDashboardName = screen.getByText(
      mockDashboards[0].dashboard_title,
    );
    fireEvent.click(firstDashboardName);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '1 Selected',
      );
    });

    // Select second card
    const secondDashboardName = screen.getByText(
      mockDashboards[1].dashboard_title,
    );
    fireEvent.click(secondDashboardName);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '2 Selected',
      );
    });

    // Verify Delete and Export buttons appear
    const bulkActions = screen.getAllByTestId('bulk-select-action');
    expect(bulkActions.find(btn => btn.textContent === 'Delete')).toBeTruthy();
    expect(bulkActions.find(btn => btn.textContent === 'Export')).toBeTruthy();

    // Click deselect all
    const deselectAllButton = screen.getByTestId('bulk-select-deselect-all');
    fireEvent.click(deselectAllButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '0 Selected',
      );
    });

    // Bulk action buttons should disappear
    expect(screen.queryByTestId('bulk-select-action')).not.toBeInTheDocument();
  });

  test('can bulk export selected dashboards', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');
    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Select dashboards by clicking on each card
    for (let i = 0; i < mockDashboards.length; i += 1) {
      const dashboardName = screen.getByText(mockDashboards[i].dashboard_title);
      fireEvent.click(dashboardName);
    }

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockDashboards.length} Selected`,
      );
    });

    const bulkExportButton = screen.getByText('Export');
    fireEvent.click(bulkExportButton);

    expect(mockHandleResourceExport).toHaveBeenCalledWith(
      'dashboard',
      mockDashboards.map(d => d.id),
      expect.any(Function),
    );
  });

  test('can bulk delete selected dashboards', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');
    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Enable bulk select mode
    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Select dashboards
    for (let i = 0; i < mockDashboards.length; i += 1) {
      const dashboardName = screen.getByText(mockDashboards[i].dashboard_title);
      fireEvent.click(dashboardName);
    }

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockDashboards.length} Selected`,
      );
    });

    const bulkDeleteButton = screen.getByText('Delete');
    fireEvent.click(bulkDeleteButton);

    await waitFor(() => {
      expect(screen.getByText('Please confirm')).toBeInTheDocument();
    });

    // Type DELETE in the confirmation input
    const deleteInput = screen.getByTestId('delete-modal-input');
    await userEvent.type(deleteInput, 'DELETE');

    // Mock the bulk DELETE endpoint
    fetchMock.delete('glob:*/api/v1/dashboard/?*', {
      message: 'Dashboards deleted',
    });

    // Click confirm button
    const confirmButton = screen.getByTestId('modal-confirm-button');
    fireEvent.click(confirmButton);

    // Verify bulk delete API was called
    await waitFor(() => {
      const deleteCalls = fetchMock.callHistory.calls(
        /api\/v1\/dashboard\/\?/,
        { method: 'DELETE' },
      );
      expect(deleteCalls).toHaveLength(1);
    });
  });

  test('exit bulk select by hitting x on bulk select bar', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');
    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Click the X button to close bulk select
    const bulkSelectBar = screen.getByTestId('bulk-select-controls');
    const closeButton = within(bulkSelectBar).getByRole('button', {
      name: /close/i,
    });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(
        screen.queryByTestId('bulk-select-controls'),
      ).not.toBeInTheDocument();
    });
  });

  test('card click behavior changes in bulk select mode', async () => {
    renderDashboardList(mockUser);

    await screen.findByTestId('dashboard-list-view');
    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('bulk-select-controls'),
    ).not.toBeInTheDocument();

    const bulkSelectButton = screen.getByTestId('bulk-select');
    fireEvent.click(bulkSelectButton);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-controls')).toBeInTheDocument();
    });

    // Clicking on cards should select them
    const firstDashboardName = screen.getByText(
      mockDashboards[0].dashboard_title,
    );
    fireEvent.click(firstDashboardName);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '1 Selected',
      );
    });

    // Clicking the same card again should deselect it
    fireEvent.click(firstDashboardName);

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        '0 Selected',
      );
    });
  });
});

afterEach(() => fetchMock.clearHistory().removeRoutes());

const enableCardViewWith = (...flags: FeatureFlag[]) =>
  (
    isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
  ).mockImplementation(
    (feature: string) =>
      feature === FeatureFlag.ListviewsDefaultCardView ||
      flags.includes(feature as FeatureFlag),
  );

// Admin qualifies as editor, so the card's delete entry is enabled; the role
// check needs a user with a `permissions` key.
const adminUser = { ...mockUser, username: 'admin', permissions: {} };

const openFirstCardMenu = async () => {
  renderDashboardList(adminUser);
  await screen.findByTestId('dashboard-list-view');
  await screen.findByText(mockDashboards[0].dashboard_title);
  fireEvent.click(screen.getAllByLabelText('more')[0]);
};

test('with soft delete on, the card delete flow shows the archive dialog', async () => {
  setupMocks();
  enableCardViewWith(FeatureFlag.SoftDelete);
  fetchMock.delete(`glob:*/api/v1/dashboard/${mockDashboards[0].id}`, {
    message: 'OK',
  });
  await openFirstCardMenu();

  fireEvent.click(await screen.findByText('Archive'));

  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByText(mockDashboards[0].dashboard_title, {
      selector: 'bdi',
    }),
  ).toBeInTheDocument();
  // The body comes from the shared soft-delete copy module; pin its stable
  // prefix rather than the retention-dependent full sentence.
  expect(
    within(dialog).getByText(
      /This dashboard will be moved to Recently Archived/,
    ),
  ).toBeInTheDocument();
  // Recoverable deletes drop the type-DELETE friction.
  expect(
    within(dialog).queryByTestId('delete-modal-input'),
  ).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));

  await waitFor(() => {
    expect(
      fetchMock.callHistory.calls(
        `glob:*/api/v1/dashboard/${mockDashboards[0].id}`,
        { method: 'DELETE' },
      ),
    ).toHaveLength(1);
  });
});

test('with soft delete off, the card delete dialog is the permanent-delete one', async () => {
  setupMocks();
  enableCardViewWith();
  await openFirstCardMenu();

  fireEvent.click(await screen.findByText('Delete'));

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Please confirm')).toBeInTheDocument();
  expect(
    within(dialog).getByText(/Are you sure you want to delete/),
  ).toBeInTheDocument();
  expect(within(dialog).getByTestId('delete-modal-input')).toBeInTheDocument();
});

/*
 * The governed half of the card dialog, which no test here reached: every
 * test in this file enables SoftDelete and leaves ChangeManagement off, so
 * the branch that the review feature actually ships was unreachable. The
 * fix for the same defect landed on the home page's card, which did have a
 * governed test, and not on this one -- the title went on reading
 * "Archive <name>?" over a body saying the dashboard needs review first.
 */

/*
 * The lookup's answer is supplied directly rather than over HTTP. What is
 * under test here is the wiring -- whether this card's label, dialog title
 * and confirm button read the answer at all -- and that is the half that was
 * broken: the title was hardcoded to "Archive <name>?" and no surface passed
 * a confirm label.
 *
 * The other half, that the hook really asks and really returns the map, is
 * covered against a registered oracle in `src/core/deferredWrites`.
 * Splitting it this way is deliberate; driving it end to end here would mean
 * standing up an oracle per case, and a test whose answer never arrives reads
 * as "unknown" -- which would make the exempt case indistinguishable from the
 * governed one and prove nothing.
 */
const governedAnswer: { current: Record<string, boolean> } = { current: {} };

jest.mock('src/core/deferredWrites', () => ({
  ...jest.requireActual('src/core/deferredWrites'),
  useDeferral: () => governedAnswer.current,
}));

const openCardMenuWithReview = async (answer: Record<string, boolean>) => {
  governedAnswer.current = answer;
  setupMocks();
  enableCardViewWith(FeatureFlag.SoftDelete, FeatureFlag.ChangeManagement);
  fetchMock.delete(`glob:*/api/v1/dashboard/${mockDashboards[0].id}`, {
    message: 'OK',
  });
  await openFirstCardMenu();
};

test('a governed card delete is titled as a removal request, not an archive', async () => {
  await openCardMenuWithReview({ [String(mockDashboards[0].id)]: true });

  // By test id, not by text: the menu item renders an icon beside its label,
  // so the label is split across nodes.
  const entry = await screen.findByTestId(
    'dashboard-card-option-delete-button',
  );
  expect(entry).toHaveTextContent('Request removal');
  fireEvent.click(entry);

  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByText(
      `Request removal of ${mockDashboards[0].dashboard_title}?`,
    ),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByText(/needs review before it is removed/),
  ).toBeInTheDocument();
  // The button is what gets pressed, and the modal's default for a
  // recoverable delete is "Archive".
  expect(
    within(dialog).getByRole('button', { name: 'Request removal' }),
  ).toBeInTheDocument();
  expect(
    within(dialog).queryByRole('button', { name: 'Archive' }),
  ).not.toBeInTheDocument();
});

test('but an exempt card still reads as an archive throughout', async () => {
  await openCardMenuWithReview({ [String(mockDashboards[0].id)]: false });

  const entry = await screen.findByTestId(
    'dashboard-card-option-delete-button',
  );
  expect(entry).toHaveTextContent('Archive');
  expect(entry).not.toHaveTextContent('Request removal');
  fireEvent.click(entry);

  const dialog = await screen.findByRole('dialog');
  const isolatedName = within(dialog).getByText(
    mockDashboards[0].dashboard_title,
  );
  expect(isolatedName.tagName).toBe('BDI');
  expect(isolatedName.parentElement).toHaveTextContent(
    `Archive ${mockDashboards[0].dashboard_title}?`,
  );
  expect(
    within(dialog).getByText(/will be moved to Recently Archived/),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Archive' }),
  ).toBeInTheDocument();
});
