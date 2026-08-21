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
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import {
  AiAssistantPanel,
  balanceCodeFences,
  CHECKPOINT_TIMEOUT_SECONDS,
  CheckpointSection,
  getPageContextLabel,
} from './AiAssistantPanel';
import { AI_ACTION_EVENT } from './hooks/useAIAction';
import type { PageContext } from './hooks/usePageContext';

const THREAD_UUID = 'thread-uuid-1';
const RUN_ID = 'run-1';
const ASSISTANT_UUID = 'assistant-uuid-1';

const frame = (event: string, payload: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

interface MessageRecord {
  uuid: string;
  role: 'user' | 'assistant';
  content: string;
  extra?: Record<string, unknown>;
  /** The reading user's own stored rating, as the API reports it. */
  liked?: boolean;
}

/** The transcript `GET /thread/<uuid>` returns after a run. */
let persistedMessages: MessageRecord[] = [];

/**
 * The assistant message uuid the next run will be given.
 *
 * Settable because a static value makes two turns in one test claim the same
 * message, which hides anything that depends on telling them apart.
 */
let nextAssistantUuid = ASSISTANT_UUID;

/** Frames the stream endpoint will deliver, and a gate to hold it open. */
let streamFrames: string[] = [];
let holdStream: Promise<void> | undefined;

/**
 * Holds the stream once this many frames have been delivered.
 *
 * `holdStream` gates every pull, which cannot express "deliver the first frame
 * and then wait" — awaiting a resolved promise is instant. This is for asserting
 * on what the panel shows part-way through a run.
 */
let holdStreamAfterFrame: number | undefined;
let holdStreamGate: Promise<void> | undefined;

const streamBody = (): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (holdStream) {
        await holdStream;
      }
      if (holdStreamGate && index === holdStreamAfterFrame) {
        await holdStreamGate;
      }
      if (index >= streamFrames.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(streamFrames[index]));
      index += 1;
    },
  });
};

const originalFetch = global.fetch;

/**
 * The stream endpoint is read with `fetch` (not `SupersetClient`) so that a
 * checkpoint can stop the reader, so it is stubbed at the global level while the
 * REST calls stay on fetch-mock.
 */
const installStreamStub = () => {
  const fetchMockHandler = global.fetch;
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    if (url.includes('/stream?run_id=')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        body: streamBody(),
      } as unknown as Response);
    }
    return (fetchMockHandler as typeof fetch)(input, init);
  }) as unknown as typeof fetch;
};

beforeEach(() => {
  persistedMessages = [];
  nextAssistantUuid = ASSISTANT_UUID;
  streamFrames = [];
  holdStream = undefined;
  holdStreamAfterFrame = undefined;
  holdStreamGate = undefined;
  localStorage.clear();

  fetchMock.get('glob:*/api/v1/ai/agent/*', { result: [] });
  fetchMock.get(`glob:*/api/v1/ai/thread/?limit=*`, {
    count: 1,
    result: [
      {
        uuid: THREAD_UUID,
        title: 'New Chat',
        status: 'active',
        message_count: 0,
        created_on: '2026-01-01T00:00:00',
        changed_on: '2026-01-01T00:00:00',
      },
    ],
  });
  fetchMock.get(`glob:*/api/v1/ai/thread/${THREAD_UUID}`, () => ({
    result: {
      uuid: THREAD_UUID,
      title: 'New Chat',
      status: 'active',
      created_on: '2026-01-01T00:00:00',
      changed_on: '2026-01-01T00:00:00',
      messages: persistedMessages,
    },
  }));
  fetchMock.post(`glob:*/api/v1/ai/thread/${THREAD_UUID}/message`, () => ({
    result: {
      message_uuid: 'user-uuid-1',
      assistant_message_uuid: nextAssistantUuid,
      run_id: RUN_ID,
    },
  }));
  fetchMock.post(`glob:*/api/v1/ai/thread/${THREAD_UUID}/cancel`, {
    message: 'OK',
  });
  fetchMock.put(`glob:*/api/v1/ai/thread/${THREAD_UUID}`, { result: {} });
  fetchMock.post('glob:*/api/v1/ai/feedback', { message: 'OK' });

  installStreamStub();
});

afterEach(() => {
  global.fetch = originalFetch;
  fetchMock.clearHistory().removeRoutes();
  jest.useRealTimers();
});

const renderPanel = async () => {
  const result = render(<AiAssistantPanel />, {
    useRedux: true,
    useRouter: true,
  });
  // The panel loads its conversations before it is usable.
  await screen.findByLabelText('Message the assistant');
  await waitFor(() =>
    expect(
      fetchMock.callHistory.called(`glob:*/api/v1/ai/thread/${THREAD_UUID}`),
    ).toBe(true),
  );
  return result;
};

const send = async (text: string) => {
  await userEvent.type(screen.getByLabelText('Message the assistant'), text);
  await userEvent.click(screen.getByLabelText('Send'));
};

test('an empty conversation invites a question and suggests prompts', async () => {
  await renderPanel();

  expect(
    screen.getByText('Ask a question about what you are looking at.'),
  ).toBeInTheDocument();
  // Suggestions name what is on screen, so there is always at least one.
  expect(
    screen.getAllByRole('button', { name: /query|dataset|dashboard/i }).length,
  ).toBeGreaterThan(0);
});

test('sending shows the message immediately and then the answer', async () => {
  streamFrames = [
    frame('session', {
      thread_uuid: THREAD_UUID,
      message_uuid: ASSISTANT_UUID,
    }),
    frame('assistant_delta', { delta: 'Because ' }),
    frame('final', { role: 'assistant', content: 'Because of the join.' }),
    frame('done', { ok: true }),
  ];
  persistedMessages = [
    { uuid: 'user-uuid-1', role: 'user', content: 'why is this wrong?' },
    {
      uuid: ASSISTANT_UUID,
      role: 'assistant',
      content: 'Because of the join.',
    },
  ];
  await renderPanel();

  await send('why is this wrong?');

  // The user's own message is on screen before the run produces anything.
  expect(await screen.findByText('why is this wrong?')).toBeInTheDocument();
  expect(await screen.findByText('Because of the join.')).toBeInTheDocument();

  const body = JSON.parse(
    String(
      fetchMock.callHistory.calls(
        `glob:*/api/v1/ai/thread/${THREAD_UUID}/message`,
      )[0].options.body,
    ),
  );
  expect(body.content).toBe('why is this wrong?');
  expect(body.request_id).toBeTruthy();
  // Page context travels under the key the backend reads.
  expect(body.page_context).toEqual(
    expect.objectContaining({ pageType: expect.any(String) }),
  );
});

test('the page-context pill can be switched off, and then nothing is sent', async () => {
  streamFrames = [
    frame('final', { role: 'assistant', content: 'ok' }),
    frame('done', { ok: true }),
  ];
  await renderPanel();

  const pill = screen.getByTestId('chat-page-context-pill');
  expect(pill).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(pill);
  expect(pill).toHaveAttribute('aria-pressed', 'false');

  await send('hello');

  await waitFor(() => {
    const body = JSON.parse(
      String(
        fetchMock.callHistory.calls(
          `glob:*/api/v1/ai/thread/${THREAD_UUID}/message`,
        )[0].options.body,
      ),
    );
    expect(body.page_context).toBeUndefined();
  });
});

test('while a run is in flight the composer offers Stop instead of Send', async () => {
  let release: (() => void) | undefined;
  holdStream = new Promise<void>(resolve => {
    release = resolve;
  });
  streamFrames = [
    frame('final', { role: 'assistant', content: 'done' }),
    frame('done', { ok: true }),
  ];
  await renderPanel();

  await send('take your time');

  expect(
    await screen.findByLabelText('Stop the assistant'),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('Send')).not.toBeInTheDocument();

  await act(async () => {
    release?.();
  });

  expect(await screen.findByLabelText('Send')).toBeInTheDocument();
});

test('reasoning streams live, and progress announcements stay out of the way', async () => {
  let release: (() => void) | undefined;
  holdStreamAfterFrame = 2;
  holdStreamGate = new Promise<void>(resolve => {
    release = resolve;
  });
  streamFrames = [
    frame('thoughts', { delta: 'Checking the dataset' }),
    frame('thinking', { stage: 'tool', message: 'Working on your question' }),
    frame('final', { role: 'assistant', content: 'done' }),
    frame('done', { ok: true }),
  ];
  await renderPanel();

  await send('what happened?');

  // Reasoning is what is worth reading while a run works.
  expect(await screen.findByText(/Checking the dataset/)).toBeInTheDocument();

  // A `thinking` frame is a protocol-level progress announcement, and it is not
  // rendered. With the step list open it says nothing the steps do not, and
  // "Working on your question" sitting above a delivered answer made a finished
  // turn look like it was still running.
  expect(
    screen.queryByText(/Working on your question/),
  ).not.toBeInTheDocument();

  await act(async () => {
    release?.();
  });

  expect(await screen.findByText('done')).toBeInTheDocument();
});

test('a step that finishes mid-run can be opened while the run continues', async () => {
  let release: (() => void) | undefined;
  // Held once the step has been delivered but before the answer, so what is
  // asserted is the live view — not the transcript re-read that happens after a
  // run ends, which is what the persisted-step test already covers.
  holdStreamAfterFrame = 1;
  holdStreamGate = new Promise<void>(resolve => {
    release = resolve;
  });
  streamFrames = [
    frame('checkpoint', {
      summary: 'Ran a query',
      meta: {
        tool_name: 'execute_sql',
        duration_ms: 34,
        arguments: { database_id: 3 },
        display: {
          kind: 'sql_result',
          executed_sql: 'SELECT count(*) FROM birth_names',
          columns: ['count'],
          rows: [{ count: 75691 }],
          row_count: 1,
        },
      },
    }),
    frame('final', { role: 'assistant', content: 'there are 75,691' }),
    frame('done', { ok: true }),
  ];
  await renderPanel();
  await send('how many birth names?');

  // The line types itself in first, and only becomes a disclosure once it has
  // finished — an exact match on the name will not resolve until then, because
  // while typing the row holds the whole partial label in one node.
  // The list is open without being asked, because the steps are the point of
  // watching a run.
  const activity = await screen.findByTestId('chat-activity');
  expect(screen.getByTestId('chat-thought-process')).toHaveAttribute('open');

  // The line types itself in, and only becomes a disclosure once complete. Real
  // timers drive the typing, and the updates land outside React's act(), so the
  // wait has to be inside one for them to be flushed.
  await act(async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 1500);
    });
  });

  const step = screen.getByText('execute_sql');
  expect(step.closest('summary')).not.toBeNull();

  // And it opens to the SQL and the rows it returned, mid-run.
  await userEvent.click(step);
  expect(within(activity).getByText(/FROM birth_names/)).toBeInTheDocument();
  expect(
    within(activity).getByRole('cell', { name: '75691' }),
  ).toBeInTheDocument();

  await act(async () => {
    release?.();
  });
  expect(await screen.findByText('there are 75,691')).toBeInTheDocument();
});

test('a just-streamed turn shows the same detail as a reloaded one', async () => {
  streamFrames = [
    frame('thoughts', { delta: 'Reading the dashboard' }),
    frame('final', { role: 'assistant', content: 'Still here!' }),
    frame('done', { ok: true }),
  ];
  // Deliberately not returning the extra the server would hold, so the assertion
  // can only pass on what the client assembled itself. The structured view used
  // to appear only once the transcript came back carrying it, which read as the
  // detail arriving on page refresh.
  persistedMessages = [];
  await renderPanel();

  await send('test');
  await screen.findByText('Still here!');

  // The reasoning and the context it was given are both there straight away.
  await userEvent.click(await screen.findByText(/Thought process/));
  expect(screen.getByText('Context used')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Context used'));
  // The text the backend was actually given, verbatim — the same string that
  // went out in the request body, not a second rendering of it.
  expect(screen.getByText(/Current page:/)).toBeInTheDocument();
});

test('a checkpoint pauses the run and Continue resumes it', async () => {
  streamFrames = [
    frame('checkpoint', {
      summary: 'About to run three queries',
      meta: {
        // Opt in: a checkpoint that does not ask for confirmation is a
        // milestone the reader logs and passes, not a gate. Blocking on every
        // finished tool call left the panel showing progress under an answer
        // that had already been delivered.
        requires_confirmation: true,
        remaining_tasks: ['join orders', 'aggregate'],
        estimated_duration: '30s',
      },
    }),
    frame('final', { role: 'assistant', content: 'all done' }),
    frame('done', { ok: true }),
  ];
  await renderPanel();

  await send('do the long thing');

  const checkpoint = await screen.findByTestId('chat-checkpoint');
  expect(
    within(checkpoint).getByText('About to run three queries'),
  ).toBeInTheDocument();
  expect(within(checkpoint).getByText('join orders')).toBeInTheDocument();
  expect(within(checkpoint).getByText('Est. ~30s')).toBeInTheDocument();
  // The answer must not have arrived: the reader is held at the checkpoint.
  expect(screen.queryByText('all done')).not.toBeInTheDocument();

  await userEvent.click(
    within(checkpoint).getByRole('button', { name: 'Continue' }),
  );

  expect(await screen.findByText('all done')).toBeInTheDocument();
});

test('a checkpoint counts down and continues on its own when it expires', () => {
  jest.useFakeTimers();
  const onContinue = jest.fn();
  render(
    <CheckpointSection
      checkpoint={{ summary: 'Pausing' }}
      onContinue={onContinue}
      onCancel={jest.fn()}
    />,
  );

  expect(
    screen.getByText(`0:${CHECKPOINT_TIMEOUT_SECONDS}`),
  ).toBeInTheDocument();

  act(() => {
    jest.advanceTimersByTime(5_000);
  });
  expect(
    screen.getByText(`0:${CHECKPOINT_TIMEOUT_SECONDS - 5}`),
  ).toBeInTheDocument();
  expect(onContinue).not.toHaveBeenCalled();

  // A user who walked away must not strand the run.
  act(() => {
    jest.advanceTimersByTime(CHECKPOINT_TIMEOUT_SECONDS * 1000);
  });
  expect(onContinue).toHaveBeenCalled();
});

test('a checkpoint honours a countdown the backend has already started', () => {
  jest.useFakeTimers();
  render(
    <CheckpointSection
      checkpoint={{ summary: 'Pausing', seconds_remaining: 90 }}
      onContinue={jest.fn()}
      onCancel={jest.fn()}
    />,
  );

  expect(screen.getByText('1:30')).toBeInTheDocument();
});

test('Cancel on a checkpoint stops the run and tells the server', async () => {
  streamFrames = [
    frame('checkpoint', {
      summary: 'Pausing',
      meta: { requires_confirmation: true },
    }),
    frame('final', { role: 'assistant', content: 'should not arrive' }),
    frame('done', { ok: true }),
  ];
  await renderPanel();

  await send('do the long thing');
  const checkpoint = await screen.findByTestId('chat-checkpoint');

  await userEvent.click(
    within(checkpoint).getByRole('button', { name: 'Cancel' }),
  );

  await waitFor(() =>
    expect(
      fetchMock.callHistory.called(
        `glob:*/api/v1/ai/thread/${THREAD_UUID}/cancel`,
      ),
    ).toBe(true),
  );
  expect(screen.queryByText('should not arrive')).not.toBeInTheDocument();
});

test('an error frame is reported in the transcript', async () => {
  streamFrames = [
    frame('error', { error: 'the warehouse refused the query' }),
    frame('done', { ok: false }),
  ];
  await renderPanel();

  await send('break it');

  expect(
    await screen.findByText(/the warehouse refused the query/),
  ).toBeInTheDocument();
});

test('rating an answer posts feedback keyed by the message uuid', async () => {
  streamFrames = [
    frame('final', { role: 'assistant', content: 'the answer' }),
    frame('done', { ok: true }),
  ];
  persistedMessages = [
    { uuid: 'user-uuid-1', role: 'user', content: 'ask' },
    { uuid: ASSISTANT_UUID, role: 'assistant', content: 'the answer' },
  ];
  await renderPanel();

  await send('ask');
  await screen.findByText('the answer');

  await userEvent.click(await screen.findByLabelText('Good response'));

  await waitFor(() =>
    expect(fetchMock.callHistory.called('glob:*/api/v1/ai/feedback')).toBe(
      true,
    ),
  );
  const body = JSON.parse(
    String(
      fetchMock.callHistory.calls('glob:*/api/v1/ai/feedback')[0].options.body,
    ),
  );
  expect(body).toEqual({ message_uuid: ASSISTANT_UUID, liked: true });

  // The verdict is visible, and pressing it again does nothing: there is no
  // endpoint to withdraw a rating.
  const liked = screen.getByLabelText('Good response');
  expect(liked).toBeDisabled();
  await userEvent.click(liked);
  expect(fetchMock.callHistory.calls('glob:*/api/v1/ai/feedback')).toHaveLength(
    1,
  );
});

test('a rating can be changed after a mis-click', async () => {
  streamFrames = [
    frame('final', { role: 'assistant', content: 'the answer' }),
    frame('done', { ok: true }),
  ];
  persistedMessages = [
    { uuid: 'user-uuid-1', role: 'user', content: 'ask' },
    { uuid: ASSISTANT_UUID, role: 'assistant', content: 'the answer' },
  ];
  await renderPanel();

  await send('ask');
  await screen.findByText('the answer');

  await userEvent.click(await screen.findByLabelText('Good response'));
  await waitFor(() =>
    expect(screen.getByLabelText('Good response')).toBeDisabled(),
  );

  // The other thumb stays available, so the verdict is correctable.
  await userEvent.click(screen.getByLabelText('Bad response'));

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/ai/feedback'),
    ).toHaveLength(2),
  );
  const second = JSON.parse(
    String(
      fetchMock.callHistory.calls('glob:*/api/v1/ai/feedback')[1].options.body,
    ),
  );
  expect(second).toEqual({ message_uuid: ASSISTANT_UUID, liked: false });

  // And the change is what is now shown.
  await waitFor(() =>
    expect(screen.getByLabelText('Bad response')).toBeDisabled(),
  );
  expect(screen.getByLabelText('Good response')).toBeEnabled();
});

test('a rating left before a reload is shown rather than offered again', async () => {
  streamFrames = [
    frame('final', { role: 'assistant', content: 'the answer' }),
    frame('done', { ok: true }),
  ];
  persistedMessages = [
    { uuid: 'user-uuid-1', role: 'user', content: 'ask' },
    {
      uuid: ASSISTANT_UUID,
      role: 'assistant',
      content: 'the answer',
      // The reading user's own stored verdict, as the transcript reports it.
      liked: false,
    },
  ];
  await renderPanel();

  await send('ask');
  await screen.findByText('the answer');

  await waitFor(() =>
    expect(screen.getByLabelText('Bad response')).toBeDisabled(),
  );
  // Shown, not re-submitted: reading a stored verdict is not a new vote.
  expect(screen.getByLabelText('Good response')).toBeEnabled();
  expect(fetchMock.callHistory.called('glob:*/api/v1/ai/feedback')).toBe(false);
});

test('a persisted SQL step is shown as SQL, not as a blob of JSON', async () => {
  streamFrames = [
    frame('final', { role: 'assistant', content: 'here you go' }),
    frame('done', { ok: true }),
  ];
  persistedMessages = [
    { uuid: 'user-uuid-1', role: 'user', content: 'run it' },
    {
      uuid: ASSISTANT_UUID,
      role: 'assistant',
      content: 'here you go',
      extra: {
        tool_calls: [
          {
            name: 'run_sql',
            ok: true,
            duration_ms: 12,
            display: {
              kind: 'sql_result',
              executed_sql: 'SELECT count(*) FROM orders',
              columns: ['n'],
              rows: [{ n: 5 }],
              row_count: 1,
            },
          },
        ],
      },
    },
  ];
  await renderPanel();

  await send('run it');
  await screen.findByText('here you go');

  // The summary states the shape of the work before it is opened, because that
  // is often the whole question the reader has.
  await userEvent.click(
    await screen.findByText(/Thought process · 1 step\(s\)/),
  );

  // The step collapses to one scannable line: which tool, what it produced, how
  // long it took.
  await userEvent.click(screen.getByText('run_sql'));
  expect(screen.getByText(/1 row\(s\)/)).toBeInTheDocument();
  expect(screen.getByText(/12ms/)).toBeInTheDocument();

  // And opens to the SQL and the rows it returned, rather than a JSON blob.
  expect(
    screen.getByText(/SELECT count\(\*\) FROM orders/),
  ).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'n' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '5' })).toBeInTheDocument();
});

test('a failed step says so without hiding why', async () => {
  streamFrames = [
    frame('final', { role: 'assistant', content: 'I could not do that' }),
    frame('done', { ok: true }),
  ];
  persistedMessages = [
    { uuid: 'user-uuid-1', role: 'user', content: 'summarise this' },
    {
      uuid: ASSISTANT_UUID,
      role: 'assistant',
      content: 'I could not do that',
      extra: {
        tool_calls: [
          {
            name: 'get_dashboard_context',
            ok: false,
            duration_ms: 0,
            error: "'dashboard_id' must be a positive integer.",
            arguments: { dashboard_id: null },
          },
        ],
      },
    },
  ];
  await renderPanel();

  await send('summarise this');
  await screen.findByText('I could not do that');

  // A failure is counted in the summary, so a reader knows the answer was
  // reached the hard way without having to open anything.
  await userEvent.click(
    await screen.findByText(/Thought process · 1 step\(s\) · 1 failed/),
  );

  await userEvent.click(screen.getByText('get_dashboard_context'));
  expect(
    screen.getByText("'dashboard_id' must be a positive integer."),
  ).toBeInTheDocument();
  // Including what it was called with, which is usually the explanation.
  expect(screen.getByText('dashboard_id')).toBeInTheDocument();
});

test('the page context a turn was given is shown alongside its steps', async () => {
  streamFrames = [
    frame('final', { role: 'assistant', content: 'about 300' }),
    frame('done', { ok: true }),
  ];
  persistedMessages = [
    { uuid: 'user-uuid-1', role: 'user', content: 'how many?' },
    {
      uuid: ASSISTANT_UUID,
      role: 'assistant',
      content: 'about 300',
      extra: {
        page_context: '# What the user is looking at\n\n- dashboard_id: 14',
      },
    },
  ];
  await renderPanel();

  await send('how many?');
  await screen.findByText('about 300');

  await userEvent.click(await screen.findByText(/Thought process/));
  await userEvent.click(screen.getByText('Context used'));
  expect(screen.getByText(/dashboard_id: 14/)).toBeInTheDocument();
});

test('an AI action opens a new conversation and asks its question', async () => {
  fetchMock.post('glob:*/api/v1/ai/thread/', {
    result: {
      uuid: THREAD_UUID,
      title: 'New Chat',
      status: 'active',
      created_on: '2026-01-01T00:00:00',
      changed_on: '2026-01-01T00:00:00',
    },
  });
  streamFrames = [
    frame('final', { role: 'assistant', content: 'the query is fine' }),
    frame('done', { ok: true }),
  ];
  await renderPanel();

  act(() => {
    window.dispatchEvent(
      new CustomEvent(AI_ACTION_EVENT, {
        detail: { prompt: 'Debug this query', systemPrompt: 'Be terse' },
      }),
    );
  });

  // Scoped to the transcript: the conversation is also titled after the prompt.
  await waitFor(() =>
    expect(
      within(screen.getByTestId('chat-messages')).getByText('Debug this query'),
    ).toBeInTheDocument(),
  );
  await waitFor(() => {
    const calls = fetchMock.callHistory.calls(
      `glob:*/api/v1/ai/thread/${THREAD_UUID}/message`,
    );
    expect(calls.length).toBeGreaterThan(0);
    const body = JSON.parse(String(calls[0].options.body));
    // A system directive has no channel of its own in this contract, so it rides
    // with the page context.
    expect(body.page_context.helper_directives).toContain('Be terse');
  });
});

test('the page-context pill names the thing on screen', () => {
  const base: PageContext = { url: '/', pathname: '/x', pageType: 'other' };

  expect(getPageContextLabel(base)).toBe('/x');
  expect(
    getPageContextLabel({
      ...base,
      pageType: 'dashboard',
      dashboardContext: { title: 'Sales' },
    }),
  ).toBe('Dashboard: Sales');
  expect(
    getPageContextLabel({
      ...base,
      pageType: 'explore',
      chartContext: { chartName: 'Revenue' },
    }),
  ).toBe('Chart: Revenue');
  expect(
    getPageContextLabel({
      ...base,
      pageType: 'sqllab',
      sqlContext: { activeEditor: { name: 'Untitled Query 1' } },
    }),
  ).toBe('Untitled Query 1');
});

test('a finished turn keeps its thought process closed', async () => {
  streamFrames = [
    frame('final', { role: 'assistant', content: 'about 300' }),
    frame('done', { ok: true }),
  ];
  persistedMessages = [
    { uuid: 'user-uuid-1', role: 'user', content: 'how many?' },
    {
      uuid: ASSISTANT_UUID,
      role: 'assistant',
      content: 'about 300',
      extra: { page_context: '# What the user is looking at' },
    },
  ];
  await renderPanel();

  await send('how many?');
  await screen.findByText('about 300');

  // The turn that just ended keeps its detail open: collapsing it the instant
  // the answer lands would pull the answer up the panel mid-read.
  await waitFor(() =>
    expect(screen.getByTestId('chat-thought-process')).toHaveAttribute('open'),
  );

  // A second turn takes over, and the first collapses — the record is available
  // rather than in the way once it is no longer the live one.
  streamFrames = [
    frame('final', { role: 'assistant', content: 'and again' }),
    frame('done', { ok: true }),
  ];
  persistedMessages = [
    ...persistedMessages,
    { uuid: 'user-uuid-2', role: 'user', content: 'again?' },
    {
      uuid: 'assistant-uuid-2',
      role: 'assistant',
      content: 'and again',
      extra: { page_context: '# What the user is looking at' },
    },
  ];
  nextAssistantUuid = 'assistant-uuid-2';
  await send('again?');
  await screen.findByText('and again');

  await waitFor(() => {
    const sections = screen.getAllByTestId('chat-thought-process');
    expect(sections).toHaveLength(2);
    expect(sections[0]).not.toHaveAttribute('open');
    expect(sections[1]).toHaveAttribute('open');
  });
});

test('closing the thought process during a run keeps it closed', async () => {
  let release: (() => void) | undefined;
  holdStreamAfterFrame = 1;
  holdStreamGate = new Promise<void>(resolve => {
    release = resolve;
  });
  streamFrames = [
    frame('thinking', { stage: 'tool', message: 'Working' }),
    frame('final', { role: 'assistant', content: 'done' }),
    frame('done', { ok: true }),
  ];
  await renderPanel();

  await send('go');

  const section = await screen.findByTestId('chat-thought-process');
  expect(section).toHaveAttribute('open');

  // A run re-renders on every frame, so the closed state has to be held rather
  // than left to the DOM's own attribute — otherwise the next frame re-opens it
  // under the user.
  await userEvent.click(within(section).getByText(/Thought process/));
  expect(section).not.toHaveAttribute('open');

  await act(async () => {
    release?.();
  });

  expect(await screen.findByText('done')).toBeInTheDocument();
});

test('the answer appears as it streams, before the run finishes', async () => {
  let release: (() => void) | undefined;
  // Held after the deltas but before `final`, so what is asserted is the live
  // answer rather than the stored message.
  holdStreamAfterFrame = 3;
  holdStreamGate = new Promise<void>(resolve => {
    release = resolve;
  });
  streamFrames = [
    frame('session', {
      thread_uuid: THREAD_UUID,
      message_uuid: ASSISTANT_UUID,
    }),
    frame('assistant_delta', { delta: 'Revenue rose ' }),
    frame('assistant_delta', { delta: 'by twelve percent.' }),
    frame('final', {
      role: 'assistant',
      content: 'Revenue rose by twelve percent.',
    }),
    frame('done', { ok: true }),
  ];
  await renderPanel();

  await send('how did revenue do?');

  // Both deltas are on screen while the run is still open. These used to be
  // folded into a value nothing rendered, so the answer only appeared at the end.
  const live = await screen.findByTestId('chat-live-answer');
  await waitFor(() =>
    expect(live).toHaveTextContent('Revenue rose by twelve percent.'),
  );

  await act(async () => {
    release?.();
  });

  // Replaced by the stored message, not duplicated alongside it.
  expect(
    await screen.findByText('Revenue rose by twelve percent.'),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByTestId('chat-live-answer')).not.toBeInTheDocument(),
  );
});

test('an unfinished code fence is closed before the partial answer is parsed', () => {
  // The states a streamed SQL block actually passes through, delta by delta.
  expect(balanceCodeFences('Rows:\n\n```')).toBe('Rows:\n\n```\n```');
  expect(balanceCodeFences('Rows:\n\n```sql')).toBe('Rows:\n\n```sql\n```');
  expect(balanceCodeFences('Rows:\n\n```sql\nSELECT 1')).toBe(
    'Rows:\n\n```sql\nSELECT 1\n```',
  );
  // Already balanced, so left alone.
  expect(balanceCodeFences('Rows:\n\n```sql\nSELECT 1\n```')).toBe(
    'Rows:\n\n```sql\nSELECT 1\n```',
  );
  // Prose with no fence at all is untouched.
  expect(balanceCodeFences('just text')).toBe('just text');
});

test('a streamed code fence does not leak backticks into the answer', async () => {
  let release: (() => void) | undefined;
  holdStreamAfterFrame = 4;
  holdStreamGate = new Promise<void>(resolve => {
    release = resolve;
  });
  // The fence arrives in pieces, exactly as the gateway sends it.
  streamFrames = [
    frame('assistant_delta', { delta: '75,691 rows.' }),
    frame('assistant_delta', { delta: '\n\n```' }),
    frame('assistant_delta', { delta: 'sql' }),
    frame('assistant_delta', { delta: '\nSELECT count(*) FROM birth_names' }),
    frame('final', { role: 'assistant', content: 'done' }),
    frame('done', { ok: true }),
  ];
  await renderPanel();
  await send('how many?');

  const live = await screen.findByTestId('chat-live-answer');
  await waitFor(() => expect(live).toHaveTextContent(/SELECT count/));

  // `react-markdown` is mocked to a passthrough here (see spec/helpers/shim),
  // so what lands in the DOM is the markdown handed to it — which is what makes
  // the balancing observable. A real renderer turns this into a code block; an
  // unbalanced one would have shown the opening backticks as text.
  const text = live.textContent ?? '';
  expect(text.match(/```/g)).toHaveLength(2);
  expect(text.trimEnd().endsWith('```')).toBe(true);

  await act(async () => {
    release?.();
  });
  expect(await screen.findByText('done')).toBeInTheDocument();
});
