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
/**
 * @fileoverview What the banner claims is on screen.
 *
 * SOW 5.5: an author with an unsubmitted draft sees the live asset until
 * they turn Show changes on. The banner used to say "Viewing your changes"
 * regardless, which is the opposite of the truth before the switch is
 * flipped (QA-19).
 *
 * The reviewer's line had the same fault for longer and more quietly: it
 * read the same with the switch on and off, so the one persistent
 * statement at the top of the page could not be used to tell the two
 * apart. Approving is not gated on having looked, so the expensive mistake
 * is a reviewer deciding on the live chart without ever flipping it.
 */
import { render, screen } from 'spec/helpers/testing-library';
import ReviewBanner from './ReviewBanner';
import type { ChangeRequest } from './types';

const draft = {
  id: 1,
  asset_type: 'dashboard',
  asset_id: 3,
  status: 'draft',
  is_author: true,
  changed_on: new Date().toISOString(),
  note: null,
} as unknown as ChangeRequest;

const show = (showChanges?: { showing: boolean }) =>
  render(
    <ReviewBanner
      changeRequest={draft}
      onShowWhatChanged={() => {}}
      onRequestReview={() => {}}
      {...(showChanges
        ? { showChanges: { ...showChanges, busy: false, toggle: () => {} } }
        : {})}
    />,
    { useRedux: true, useRouter: true },
  );

test('with the preview off, the banner says the live version is on screen', () => {
  show({ showing: false });

  expect(
    screen.getByText(/you and viewers are both seeing the live version/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/^Viewing your changes/)).not.toBeInTheDocument();
});

test('with the preview on, it says the author is viewing their changes', () => {
  show({ showing: true });

  expect(screen.getByText(/Viewing your changes/)).toBeInTheDocument();
});

test('where there is no preview at all, it says the live version is on screen', () => {
  // This used to assert the opposite, on the reasoning that an asset with
  // no in-place preview must be showing the author their own draft. That
  // holds for a dashboard, whose author keeps editing in place. It is false
  // for a chart: `canPreview` is dashboard-only, and after a held save
  // Explore reloads the live slice, so the author was told they were
  // viewing changes that were nowhere on screen (sc-131032).
  show(undefined);

  expect(
    screen.getByText(/you and viewers are both seeing the live version/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/^Viewing your changes/)).not.toBeInTheDocument();
});

test('with no preview it does not point at a switch that is not there', () => {
  show(undefined);

  expect(screen.queryByText(/turn on Show changes/)).not.toBeInTheDocument();
});

test('with the preview off it does point at the switch', () => {
  show({ showing: false });

  expect(screen.getByText(/turn on Show changes/)).toBeInTheDocument();
});

const pending = {
  id: 2,
  asset_type: 'chart',
  asset_id: 9,
  status: 'pending',
  can_approve: true,
  is_author: false,
  author: { id: 3, first_name: 'Priya', last_name: 'Shah' },
  changed_fields: ['params'],
  submitted_at: new Date().toISOString(),
  changed_on: new Date().toISOString(),
  note: null,
} as unknown as ChangeRequest;

const showReviewer = (showing: boolean) =>
  render(
    <ReviewBanner
      changeRequest={pending}
      onShowWhatChanged={() => {}}
      onRequestReview={() => {}}
      showChanges={{ showing, busy: false, toggle: () => {} }}
    />,
    { useRedux: true, useRouter: true },
  );

test('the reviewer is told they are on the live version', () => {
  showReviewer(false);

  expect(
    screen.getByText(/Priya Shah proposed .* you are seeing the live version/),
  ).toBeInTheDocument();
});

test('the reviewer is told when they are on the proposal', () => {
  showReviewer(true);

  expect(
    screen.getByText(/Priya Shah proposed .* you are seeing the proposal/),
  ).toBeInTheDocument();
});

test("the reviewer's banner is not the same in both states", () => {
  // The structural half. The two assertions above would both pass against a
  // single string containing either phrase, and the bug was that one string
  // served both states.
  const off = showReviewer(false).container.textContent;
  const on = showReviewer(true).container.textContent;

  expect(off).not.toEqual(on);
});

/**
 * The layout a draft puts the banner in.
 *
 * A draft carries the longest message and the most controls (the switch plus
 * three buttons). In Explore the banner is only a few hundred pixels wide, and
 * when the message and the controls were laid out as non-wrapping siblings the
 * controls kept their full width and left the message a column a few
 * characters wide. What a test can pin is the structure that prevents that,
 * not any width: the message sits in its own element, apart from the controls,
 * and the two are laid out in a row that wraps.
 */
const showDraftWithControls = () =>
  render(
    <ReviewBanner
      changeRequest={draft}
      onShowWhatChanged={() => {}}
      onRequestReview={() => {}}
      onDiscard={() => {}}
      showChanges={{ showing: false, busy: false, toggle: () => {} }}
    />,
    { useRedux: true, useRouter: true },
  );

test('a draft renders its message and every control inside the one banner', () => {
  showDraftWithControls();

  const banner = screen.getByRole('alert');
  expect(banner).toHaveTextContent(/Your changes are saved/);
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByRole('switch', { name: 'Show changes' })).toBeVisible();
  ['What changed', 'Request review', 'Discard changes…'].forEach(name => {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });
});

test('the message is its own element, not one the controls share', () => {
  showDraftWithControls();

  const message = screen.getByText(/Your changes are saved/);

  expect(message.querySelector('button, [role="switch"]')).toBeNull();
  ['What changed', 'Request review', 'Discard changes…'].forEach(name => {
    expect(message).not.toContainElement(
      screen.getByRole('button', { name }),
    );
  });
});

test('the message and the controls are laid out in a row that can wrap', () => {
  showDraftWithControls();

  const message = screen.getByText(/Your changes are saved/);
  const row = message.parentElement as HTMLElement;
  const controls = screen.getByRole('button', {
    name: 'Request review',
  }).parentElement as HTMLElement;

  // One row holds both, so the controls can drop below the message rather
  // than squeeze it.
  expect(row).toContainElement(controls);
  expect(row).toHaveStyle({ flexWrap: 'wrap' });
  // And if even a line to themselves is too narrow, the controls wrap too.
  expect(controls).toHaveStyle({ flexWrap: 'wrap' });
});

test('with no preview there is no switch, and the other controls remain', () => {
  render(
    <ReviewBanner
      changeRequest={draft}
      onShowWhatChanged={() => {}}
      onRequestReview={() => {}}
      onDiscard={() => {}}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Request review' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Discard changes…' }),
  ).toBeInTheDocument();
});

describe('the author in edit mode, with their save already stored', () => {
  /**
   * This state did not exist until the author stopped being thrown out of
   * the editor on every captured save. It is now somewhere they sit and
   * work, so it has to carry the actions that state needs.
   *
   * Written because the first version of it returned What changed alone.
   * That dropped Request review from the moment an author is most likely
   * to want it, and dropped Discard -- which is in this banner precisely
   * because two testers opened a stale draft, looked for a way out, found
   * none, and carried on editing on top of it.
   */
  const draft = {
    id: 5,
    asset_type: 'dashboard',
    asset_id: 6,
    status: 'draft',
    is_open: true,
    is_author: true,
    can_approve: false,
    changed_on: new Date().toISOString(),
    changed_fields: ['dashboard_title'],
  } as unknown as ChangeRequest;

  const renderEditing = (over: Record<string, unknown> = {}) =>
    render(
      <ReviewBanner
        changeRequest={draft}
        editing
        onShowWhatChanged={() => {}}
        onRequestReview={() => {}}
        onDiscard={() => {}}
        {...over}
      />,
      { useRedux: true, useRouter: true },
    );

  test('says the author is looking at their changes, not at live', () => {
    renderEditing();

    expect(screen.getByRole('alert')).toHaveTextContent(/Viewing your changes/);
    // The sentence below this branch describes a page showing the published
    // asset. In edit mode that page is the draft, so it would be false.
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      /you and viewers are both seeing the live version/,
    );
  });

  test('keeps Request review and Discard', () => {
    renderEditing();

    expect(
      screen.getByRole('button', { name: /Request review/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Discard/i }),
    ).toBeInTheDocument();
  });
});

describe('the author while their change is with a reviewer', () => {
  /**
   * The sentence has to name which version is on screen, because now there
   * are two it could be. While the author defaulted to the live asset this
   * branch could say nothing and still be unambiguous; opening them on
   * their own changes made silence a wrong answer, next to a header pill
   * that reads Published for something viewers cannot see.
   */
  const pending = {
    id: 7,
    asset_type: 'dashboard',
    asset_id: 6,
    status: 'pending',
    is_open: true,
    is_author: true,
    can_approve: false,
    submitted_at: new Date().toISOString(),
    changed_on: new Date().toISOString(),
    changed_fields: ['dashboard_title'],
    eligible_approvers: [{ first_name: 'Priya', last_name: 'Shah' }],
  } as unknown as ChangeRequest;

  const renderPending = (showing: boolean) =>
    render(
      <ReviewBanner
        changeRequest={pending}
        showChanges={{ showing, busy: false, toggle: () => {} }}
        onShowWhatChanged={() => {}}
        onWithdraw={() => {}}
      />,
      { useRedux: true, useRouter: true },
    );

  test('says so when the author is looking at their own changes', () => {
    renderPending(true);

    expect(screen.getByRole('alert')).toHaveTextContent(
      /you are seeing your changes/,
    );
  });

  test('says so when they have switched to the live version', () => {
    renderPending(false);

    expect(screen.getByRole('alert')).toHaveTextContent(
      /you are seeing the live version/,
    );
  });

  test('still names who can approve and how long it has waited', () => {
    renderPending(true);

    expect(screen.getByRole('alert')).toHaveTextContent(/Awaiting review/);
    expect(screen.getByRole('alert')).toHaveTextContent(/Priya Shah/);
  });
});

describe('the author in edit mode while their change is with a reviewer', () => {
  /**
   * The author now stays in the editor through a captured save and on
   * through the submit, so this is the state they are in the instant after
   * pressing Request review: the canvas holds their draft, with the row
   * they deleted gone from it.
   *
   * The clause that names the version on screen read it off the preview
   * switch alone. The switch is withheld entirely in edit mode -- it
   * re-hydrates the dashboard and would throw unsaved edits away -- so it
   * is always "off" there, and the banner told an author looking at their
   * own draft that they were seeing the live version.
   */
  const pending = {
    id: 8,
    asset_type: 'dashboard',
    asset_id: 6,
    status: 'pending',
    is_open: true,
    is_author: true,
    can_approve: false,
    submitted_at: new Date().toISOString(),
    changed_on: new Date().toISOString(),
    changed_fields: ['dashboard_title'],
    eligible_approvers: [{ first_name: 'Priya', last_name: 'Shah' }],
  } as unknown as ChangeRequest;

  const renderEditingPending = (over: Record<string, unknown> = {}) =>
    render(
      <ReviewBanner
        changeRequest={pending}
        editing
        onShowWhatChanged={() => {}}
        onWithdraw={() => {}}
        {...over}
      />,
      { useRedux: true, useRouter: true },
    );

  test('the canvas is the draft, so that is what it says', () => {
    renderEditingPending();

    expect(screen.getByRole('alert')).toHaveTextContent(/Awaiting review/);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /you are seeing your changes/,
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      /you are seeing the live version/,
    );
  });

  test('mid-edit it says the edits are unsaved rather than name a version', () => {
    renderEditingPending({ editingUnsaved: true });

    expect(screen.getByRole('alert')).toHaveTextContent(
      /you are seeing your unsaved edits/,
    );
  });

  test('out of edit mode the switch is the source again', () => {
    render(
      <ReviewBanner
        changeRequest={pending}
        showChanges={{ showing: false, busy: false, toggle: () => {} }}
        onShowWhatChanged={() => {}}
        onWithdraw={() => {}}
      />,
      { useRedux: true, useRouter: true },
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      /you are seeing the live version/,
    );
  });
});

describe('a change the reviewer sent back', () => {
  /**
   * The author's route back, which this branch did not offer.
   *
   * It returned What changed alone, and the toolbar's Request review
   * wanted `status === 'draft'`, so an author asked to revise who entered
   * edit mode and changed nothing had no way to resubmit from either
   * surface -- beside a disabled button whose tooltip read "No changes to
   * review yet." two inches under this banner naming the reviewer and
   * quoting what they had asked for.
   *
   * Offered with no fresh edit required: `lifecycle.submit` accepts
   * CHANGES_REQUESTED as it accepts DRAFT, and the Approvals list has
   * always offered Request review on the same row.
   */
  const returned = {
    id: 11,
    asset_type: 'dashboard',
    asset_id: 6,
    status: 'changes_requested',
    is_open: true,
    is_author: true,
    can_approve: false,
    review_note: 'Use the approved colour scheme, not the custom one.',
    reviewer: { id: 4, first_name: 'Priya', last_name: 'Shah' },
    decided_at: new Date().toISOString(),
    changed_on: new Date().toISOString(),
    changed_fields: ['dashboard_title'],
  } as unknown as ChangeRequest;

  const renderReturned = (over: Record<string, unknown> = {}) =>
    render(
      <ReviewBanner
        changeRequest={{ ...returned, ...over } as unknown as ChangeRequest}
        onShowWhatChanged={() => {}}
        onRequestReview={() => {}}
        onDiscard={() => {}}
      />,
      { useRedux: true, useRouter: true },
    );

  test('still says who asked for what', () => {
    renderReturned();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Priya Shah requested changes · "Use the approved colour scheme, not the custom one."',
    );
  });

  test('offers the author a way to send it back for review', () => {
    renderReturned();

    expect(
      screen.getByRole('button', { name: 'Request review' }),
    ).toBeInTheDocument();
  });

  test('and a way to abandon it instead', () => {
    renderReturned();

    expect(
      screen.getByRole('button', { name: 'Discard changes…' }),
    ).toBeInTheDocument();
  });

  test('a row with no note stored does not quote an empty one', () => {
    // Only reachable for rows written before a note was required of the
    // reviewer. It used to render `· ""`.
    renderReturned({ review_note: null });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Priya Shah requested changes',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('""');
  });

  test('another editor is told what is happening, not offered the author’s actions', () => {
    render(
      <ReviewBanner
        changeRequest={
          {
            ...returned,
            is_author: false,
            author: { id: 2, first_name: 'Alex', last_name: 'Rivera' },
          } as unknown as ChangeRequest
        }
        onShowWhatChanged={() => {}}
        onRequestReview={() => {}}
        onDiscard={() => {}}
      />,
      { useRedux: true, useRouter: true },
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      /Alex Rivera is updating this after a review/,
    );
    expect(
      screen.queryByRole('button', { name: 'Request review' }),
    ).not.toBeInTheDocument();
  });
});
