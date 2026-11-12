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
import { act, render, screen, waitFor } from 'spec/helpers/testing-library';
import { logging } from '@apache-superset/core/utils';
import {
  announceDeferred,
  hasDeferralOracle,
  heldVersion,
  invalidateDeferrals,
  onDeferralsInvalidated,
  onDeferred,
  registerDeferralOracle,
  useDeferral,
  wouldDefer,
} from '.';

const oracleAnswering = (answers: Record<string, boolean>) => ({
  wouldDefer: jest.fn().mockResolvedValue(answers),
});

let warn: jest.SpyInstance;

beforeEach(() => {
  warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

test('with nothing registered, no write is held', async () => {
  // This is the reading that matches an install with no such extension, and
  // it is the one the host's own wording describes: writes apply.
  expect(hasDeferralOracle()).toBe(false);
  await expect(wouldDefer('dashboard', [1, 2])).resolves.toEqual({
    '1': false,
    '2': false,
  });
});

test('a registered oracle decides, and is asked once for the whole page', async () => {
  const oracle = oracleAnswering({ '1': true, '2': false });
  const registration = registerDeferralOracle(oracle);
  try {
    expect(hasDeferralOracle()).toBe(true);
    await expect(wouldDefer('dashboard', [1, 2])).resolves.toEqual({
      '1': true,
      '2': false,
    });
    expect(oracle.wouldDefer).toHaveBeenCalledTimes(1);
    expect(oracle.wouldDefer).toHaveBeenCalledWith('dashboard', [1, 2]);
  } finally {
    registration.dispose();
  }
});

test('an id the oracle did not answer for reads as not held', async () => {
  // Otherwise every caller has to special-case `undefined`, and the one that
  // forgets renders a dialog promising neither outcome.
  const registration = registerDeferralOracle(oracleAnswering({ '1': true }));
  try {
    await expect(wouldDefer('chart', [1, 2, 3])).resolves.toEqual({
      '1': true,
      '2': false,
      '3': false,
    });
  } finally {
    registration.dispose();
  }
});

test('a second oracle is refused rather than silently winning', async () => {
  // Two extensions deferring writes to one asset is not a case the host can
  // resolve: "either would hold it" and "both would hold it" are different
  // promises to make in a dialog. The deployment should find out at startup,
  // not through wrong copy.
  const first = oracleAnswering({ '1': true });
  const second = oracleAnswering({ '1': false });
  const registration = registerDeferralOracle(first);
  const refused = registerDeferralOracle(second);
  try {
    await expect(wouldDefer('dashboard', [1])).resolves.toEqual({ '1': true });
    expect(second.wouldDefer).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('already registered'),
    );
  } finally {
    refused.dispose();
    registration.dispose();
  }
  // Disposing the refused registration must not have unregistered the first.
  expect(hasDeferralOracle()).toBe(false);
});

test('disposing puts the host back to deciding nothing', async () => {
  const registration = registerDeferralOracle(oracleAnswering({ '1': true }));
  registration.dispose();
  expect(hasDeferralOracle()).toBe(false);
  await expect(wouldDefer('dashboard', [1])).resolves.toEqual({ '1': false });
});

test('an oracle that throws is read as holding nothing', async () => {
  // A list page that cannot reach the extension still has to render, and the
  // wording it falls back to describes what the host itself does.
  const registration = registerDeferralOracle({
    wouldDefer: jest.fn().mockRejectedValue(new Error('unreachable')),
  });
  try {
    await expect(wouldDefer('dashboard', [7])).resolves.toEqual({
      '7': false,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      expect.any(Error),
    );
  } finally {
    registration.dispose();
  }
});

test('an empty selection asks nothing', async () => {
  const oracle = oracleAnswering({});
  const registration = registerDeferralOracle(oracle);
  try {
    await expect(wouldDefer('dashboard', [])).resolves.toEqual({});
    expect(oracle.wouldDefer).not.toHaveBeenCalled();
  } finally {
    registration.dispose();
  }
});

describe('heldVersion', () => {
  test('with nothing registered, nothing is held', async () => {
    // Hydrating what the server sent is the host's own behaviour and it is
    // correct here, so there is no second path for a caller to get wrong.
    expect(hasDeferralOracle()).toBe(false);
    await expect(heldVersion('chart', 1)).resolves.toBeNull();
  });

  test('an oracle that does not answer this question holds nothing', async () => {
    // `heldVersion` is optional, so every oracle written against
    // `wouldDefer` alone stays valid rather than crashing the page that
    // asks.
    const registration = registerDeferralOracle(oracleAnswering({ '1': true }));
    try {
      await expect(heldVersion('chart', 1)).resolves.toBeNull();
    } finally {
      registration.dispose();
    }
  });

  test('an oracle that holds one answers with what to hydrate instead', async () => {
    const payload = { form_data: { viz_type: 'table' } };
    const oracle = {
      ...oracleAnswering({ '1': true }),
      heldVersion: jest.fn().mockResolvedValue(payload),
    };
    const registration = registerDeferralOracle(oracle);
    try {
      await expect(heldVersion('chart', 1)).resolves.toBe(payload);
      expect(oracle.heldVersion).toHaveBeenCalledWith('chart', 1);
    } finally {
      registration.dispose();
    }
  });

  test('an id is passed through as given, number or slug', async () => {
    // The oracle keys its own store; the host does not know whether that is
    // by id or by slug and must not decide for it.
    const oracle = {
      ...oracleAnswering({}),
      heldVersion: jest.fn().mockResolvedValue(null),
    };
    const registration = registerDeferralOracle(oracle);
    try {
      await heldVersion('dashboard', 'sales-overview');
      expect(oracle.heldVersion).toHaveBeenCalledWith(
        'dashboard',
        'sales-overview',
      );
    } finally {
      registration.dispose();
    }
  });

  test('an oracle holding nothing says so, however it says it', async () => {
    // `undefined` and `null` are one meaning here, normalised the way
    // `wouldDefer` normalises an unanswered id: one absent answer.
    const oracle = {
      ...oracleAnswering({}),
      heldVersion: jest.fn().mockResolvedValue(undefined),
    };
    const registration = registerDeferralOracle(oracle);
    try {
      await expect(heldVersion('chart', 1)).resolves.toBeNull();
    } finally {
      registration.dispose();
    }
  });

  test('an oracle that throws is read as holding nothing', async () => {
    // Explore still has to open. Falling back to the published chart is the
    // host's own behaviour, which is what it does with no extension at all.
    const registration = registerDeferralOracle({
      ...oracleAnswering({}),
      heldVersion: jest.fn().mockRejectedValue(new Error('unreachable')),
    });
    try {
      await expect(heldVersion('chart', 1)).resolves.toBeNull();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.any(Error),
      );
    } finally {
      registration.dispose();
    }
  });

  test('disposing puts the host back to holding nothing', async () => {
    const registration = registerDeferralOracle({
      ...oracleAnswering({}),
      heldVersion: jest.fn().mockResolvedValue({ form_data: {} }),
    });
    registration.dispose();
    expect(hasDeferralOracle()).toBe(false);
    await expect(heldVersion('chart', 1)).resolves.toBeNull();
  });

  test('a refused second oracle is not asked', async () => {
    // The same rule `wouldDefer` has: two parties answering for one asset is
    // a configuration error, and the first registration keeps the question.
    const first = {
      ...oracleAnswering({}),
      heldVersion: jest.fn().mockResolvedValue(null),
    };
    const second = {
      ...oracleAnswering({}),
      heldVersion: jest.fn().mockResolvedValue({ form_data: {} }),
    };
    const registration = registerDeferralOracle(first);
    const refused = registerDeferralOracle(second);
    try {
      await expect(heldVersion('chart', 1)).resolves.toBeNull();
      expect(second.heldVersion).not.toHaveBeenCalled();
    } finally {
      refused.dispose();
      registration.dispose();
    }
  });
});

test('a deferral reaches the surfaces listening for one', () => {
  const heard: string[] = [];
  const subscription = onDeferred(write => heard.push(write.message));
  announceDeferred({ message: 'Held for review.' });
  subscription.dispose();
  announceDeferred({ message: 'After unsubscribing.' });
  expect(heard).toEqual(['Held for review.']);
});

test('an invalidation tells the asked surfaces to ask again', () => {
  const asked: number[] = [];
  const subscription = onDeferralsInvalidated(() => asked.push(1));
  invalidateDeferrals();
  invalidateDeferrals();
  subscription.dispose();
  invalidateDeferrals();
  // Twice, not three times: the third came after unsubscribing.
  expect(asked).toHaveLength(2);
});

describe('useDeferral', () => {
  const Row = ({ ids }: { ids: number[] }) => {
    const answers = useDeferral('dashboard', ids);
    return <span data-test="answers">{JSON.stringify(answers)}</span>;
  };

  const answersOnScreen = () =>
    JSON.parse(screen.getByTestId('answers').textContent || '{}');

  test('asks once for the whole page, not once per row', async () => {
    // A list needs an answer for every row it draws. Asking per row turns one
    // page render into a burst of requests.
    const oracle = oracleAnswering({ '1': true, '2': false, '3': false });
    const registration = registerDeferralOracle(oracle);
    try {
      render(<Row ids={[1, 2, 3]} />);
      await waitFor(() =>
        expect(answersOnScreen()).toEqual({
          '1': true,
          '2': false,
          '3': false,
        }),
      );
      expect(oracle.wouldDefer).toHaveBeenCalledTimes(1);
    } finally {
      registration.dispose();
    }
  });

  test('asks again when the party holding the rule says the answer moved', async () => {
    // Approving a change makes every later write to that asset governed, and
    // nothing about that is visible to this hook. A list that asked on mount
    // and never again goes on offering the wrong wording for its own row.
    let held = false;
    const registration = registerDeferralOracle({
      wouldDefer: jest.fn(async () => ({ '1': held })),
    });
    try {
      render(<Row ids={[1]} />);
      await waitFor(() => expect(answersOnScreen()).toEqual({ '1': false }));

      held = true;
      act(() => {
        invalidateDeferrals();
      });
      await waitFor(() => expect(answersOnScreen()).toEqual({ '1': true }));
    } finally {
      registration.dispose();
    }
  });

  test('a re-render with the same ids in another order asks nothing new', async () => {
    // The caller's array is a new identity on every render of a list, so
    // keying on it rather than on its contents fetches in a loop.
    const oracle = oracleAnswering({ '1': true, '2': true });
    const registration = registerDeferralOracle(oracle);
    try {
      const { rerender } = render(<Row ids={[1, 2]} />);
      await waitFor(() =>
        expect(answersOnScreen()).toEqual({
          '1': true,
          '2': true,
        }),
      );
      rerender(<Row ids={[2, 1]} />);
      await waitFor(() => expect(oracle.wouldDefer).toHaveBeenCalledTimes(1));
    } finally {
      registration.dispose();
    }
  });
});

test('with nothing registered the hook settles without a state update', async () => {
  // It used to start at `{}` and then set all-false, which re-rendered the
  // surface around it on every mount for no change in answer. A confirmation
  // dialog with a controlled "type DELETE to confirm" input lost what had
  // been typed into it that way.
  let renders = 0;
  const Counted = () => {
    renders += 1;
    const answers = useDeferral('dashboard', [1, 2]);
    return <span data-test="answers">{JSON.stringify(answers)}</span>;
  };

  render(<Counted />);
  // Answered on the first render, not after a round trip.
  expect(JSON.parse(screen.getByTestId('answers').textContent || '{}')).toEqual(
    { '1': false, '2': false },
  );
  const afterMount = renders;
  await waitFor(() => expect(renders).toBe(afterMount));
  expect(renders).toBe(afterMount);
});
