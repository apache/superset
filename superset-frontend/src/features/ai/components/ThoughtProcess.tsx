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
 * @fileoverview How an answer was arrived at, one step at a time.
 *
 * Steps arrive as structured records, both while a run streams and on a finished
 * turn, so both render the same way: each step is a single line — outcome, tool,
 * how long it took — that opens to what was actually asked and returned.
 *
 * The nesting is deliberate. Someone reading an answer wants to know it came
 * from three queries, not to read three queries; someone checking a number wants
 * the exact SQL. Both are one click apart, and neither is in the way of the
 * other.
 *
 * The two situations differ only in where they start. A run in flight opens with
 * the list showing and types each new line in, because watching the steps is the
 * point; a finished turn starts closed, because the answer is. Either way a
 * step's own detail begins closed, so the list stays scannable.
 */

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import { REMARK_PLUGINS } from './chatMarkdown';
import {
  isSqlResultDisplay,
  type AiToolCall,
  type JsonData,
  type JsonRecord,
} from '../types';

/** Result rows shown inline before the table is cut short. */
const MAX_PREVIEW_ROWS = 10;

/** Argument values are one-liners here; the full value is in the tool output. */
const MAX_ARG_CHARS = 200;

/** Recorded output is a fallback rendering, so it gets less room than a table. */
const MAX_OUTPUT_CHARS = 2_000;

/**
 * Typing cadence: one character per tick, slow enough to read along with.
 *
 * The panel's other streamed text moves faster because it is prose being
 * delivered; a step line is a single short label, and revealing it in three-
 * character jumps read as a flicker rather than as typing.
 */
const TYPEWRITER_INTERVAL_MS = 34;
const TYPEWRITER_STEP = 1;

const Section = styled.details`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  color: ${({ theme }) => theme.colorTextTertiary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  > summary {
    cursor: pointer;
    user-select: none;
    color: ${({ theme }) => theme.colorTextTertiary};
    margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const Reasoning = styled.div`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  color: ${({ theme }) => theme.colorTextTertiary};

  p:last-child {
    margin-bottom: 0;
  }
`;

const Step = styled.details`
  border-left: 2px solid ${({ theme }) => theme.colorBorderSecondary};
  padding-left: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;

  > summary {
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.sizeUnit}px;
  }
`;

/**
 * A row whose line is still typing.
 *
 * Same left rule and metrics as a `Step` summary, minus the disclosure marker,
 * so nothing shifts when the row becomes expandable.
 */
const TypingRow = styled.div`
  border-left: 2px solid ${({ theme }) => theme.colorBorderSecondary};
  padding-left: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const StepName = styled.span`
  font-family: ${({ theme }) => theme.fontFamilyCode};
  color: ${({ theme }) => theme.colorText};
`;

const Muted = styled.span`
  color: ${({ theme }) => theme.colorTextQuaternary};
`;

const StepBody = styled.div`
  padding: ${({ theme }) => theme.sizeUnit}px 0
    ${({ theme }) => theme.sizeUnit * 2}px 0;
`;

const Label = styled.div`
  color: ${({ theme }) => theme.colorTextQuaternary};
  margin-top: ${({ theme }) => theme.sizeUnit}px;
`;

const Code = styled.pre`
  margin: ${({ theme }) => theme.sizeUnit / 2}px 0 0 0;
  padding: ${({ theme }) => theme.sizeUnit}px;
  background: ${({ theme }) => theme.colorBgLayout};
  border-radius: ${({ theme }) => theme.borderRadiusSM}px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorText};
`;

const ArgList = styled.dl`
  margin: ${({ theme }) => theme.sizeUnit / 2}px 0 0 0;

  dt {
    font-family: ${({ theme }) => theme.fontFamilyCode};
    color: ${({ theme }) => theme.colorTextTertiary};
  }

  dd {
    margin: 0 0 ${({ theme }) => theme.sizeUnit / 2}px 0;
    color: ${({ theme }) => theme.colorText};
    word-break: break-word;
  }
`;

const ResultTable = styled.table`
  margin-top: ${({ theme }) => theme.sizeUnit / 2}px;
  border-collapse: collapse;
  display: block;
  overflow-x: auto;
  max-width: 100%;

  th,
  td {
    border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
    padding: ${({ theme }) => theme.sizeUnit / 2}px
      ${({ theme }) => theme.sizeUnit}px;
    text-align: left;
    white-space: nowrap;
  }

  th {
    color: ${({ theme }) => theme.colorTextTertiary};
    font-weight: ${({ theme }) => theme.fontWeightStrong};
  }

  td {
    color: ${({ theme }) => theme.colorText};
  }
`;

const ErrorText = styled.div`
  color: ${({ theme }) => theme.colorErrorText};
  word-break: break-word;
`;

const statusIcon = css`
  flex: 0 0 auto;
`;

/** A cell as a short string. Objects are JSON so a nested value is still legible. */
const formatCell = (value: JsonData | undefined): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const formatArg = (value: JsonData | undefined): string => {
  const rendered = formatCell(value);
  return rendered.length > MAX_ARG_CHARS
    ? `${rendered.slice(0, MAX_ARG_CHARS)}…`
    : rendered;
};

/** A one-line description of what a step produced, for the collapsed row. */
export const summariseOutcome = (call: AiToolCall): string => {
  if (!call.ok) {
    return t('failed');
  }
  const { display } = call;
  if (isSqlResultDisplay(display)) {
    if (display.rowCount !== undefined) {
      return t('%s row(s)', String(display.rowCount));
    }
    if (display.rows.length > 0) {
      return t('%s row(s)', String(display.rows.length));
    }
  }
  return '';
};

const StepDetail = ({
  call,
  markdownComponents,
}: {
  call: AiToolCall;
  markdownComponents?: Components;
}) => {
  const { display } = call;
  const sql = isSqlResultDisplay(display) ? display : undefined;
  const args = call.args ?? {};
  const argKeys = Object.keys(args);
  const rows = sql ? sql.rows.slice(0, MAX_PREVIEW_ROWS) : [];

  return (
    <StepBody>
      {argKeys.length > 0 && (
        <>
          <Label>{t('Asked for')}</Label>
          <ArgList>
            {argKeys.map(key => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{formatArg(args[key])}</dd>
              </div>
            ))}
          </ArgList>
        </>
      )}

      {sql?.executedSql && (
        <>
          <Label>
            {sql.databaseName
              ? t('SQL run against %s', sql.databaseName)
              : t('SQL run')}
          </Label>
          {/* Rendered as a fenced block through the transcript's own markdown
              components rather than as plain text, so the step keeps the
              highlighting and the "Run in SQL Lab" action that SQL in an answer
              gets. The database id rides in the fence info string, which is
              where that action looks for it. */}
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={REMARK_PLUGINS}
          >
            {[
              sql.databaseId === undefined
                ? '```sql'
                : `\`\`\`sql ${sql.databaseId}`,
              sql.executedSql,
              '```',
            ].join('\n')}
          </ReactMarkdown>
          {sql.executedSqlTruncated && (
            <Muted>{t('Statement clipped for display.')}</Muted>
          )}
        </>
      )}

      {sql && sql.columns.length > 0 && rows.length > 0 && (
        <>
          <Label>{t('Returned')}</Label>
          <ResultTable>
            <thead>
              <tr>
                {sql.columns.map(column => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                // Rows have no natural key: two identical rows are a legitimate
                // result, so position is the only stable identity here.
                // eslint-disable-next-line react/no-array-index-key
                <tr key={index}>
                  {sql.columns.map(column => (
                    <td key={column}>
                      {formatCell((row as JsonRecord)[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </ResultTable>
          {sql.rows.length > rows.length && (
            <Muted>
              {t('Showing %s of %s rows.', rows.length, sql.rows.length)}
            </Muted>
          )}
          {sql.sampleOnly && <Muted> {t('Sample only.')}</Muted>}
        </>
      )}

      {call.error && (
        <>
          <Label>{t('Error')}</Label>
          <ErrorText>{call.error}</ErrorText>
        </>
      )}

      {/* Only when there is nothing better: a tool with its own display has
          already been rendered above, and repeating its raw output is the JSON
          dump this view exists to replace. */}
      {!sql && !call.error && call.output && (
        <>
          <Label>{t('Returned')}</Label>
          <Code>{call.output.slice(0, MAX_OUTPUT_CHARS)}</Code>
        </>
      )}

      {call.truncated && (
        <Muted>{t('Output was clipped for the model.')}</Muted>
      )}
    </StepBody>
  );
};

/** One step as a single scannable line: what ran, what it produced, how long. */
const stepLabel = (call: AiToolCall): string =>
  [
    call.name,
    summariseOutcome(call),
    call.durationMs === undefined ? '' : t('%sms', String(call.durationMs)),
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Reveals text a few characters at a time.
 *
 * Used only for a step that has just arrived during a live run: a list that
 * appears fully-formed gives no sense of work happening, and the typing is what
 * makes a long run legible rather than suspenseful. Off for a finished turn,
 * where the text is history and animating it would just delay reading it.
 */
const useTypedText = (
  text: string,
  enabled: boolean,
): { shown: string; done: boolean } => {
  const [shown, setShown] = useState(enabled ? '' : text);

  useEffect(() => {
    if (!enabled) {
      setShown(text);
      return undefined;
    }
    let cancelled = false;
    let revealed = 0;
    setShown('');
    const id = setInterval(() => {
      if (cancelled) {
        return;
      }
      revealed = Math.min(text.length, revealed + TYPEWRITER_STEP);
      setShown(text.slice(0, revealed));
      if (revealed >= text.length) {
        clearInterval(id);
      }
    }, TYPEWRITER_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [text, enabled]);

  return { shown, done: shown.length >= text.length };
};

/**
 * One step.
 *
 * While its line is still typing it is deliberately not a disclosure: there is
 * nothing to be gained from opening a row that has not finished announcing
 * itself, and a control that appears mid-word invites a mis-click. It becomes
 * expandable the moment the line is complete.
 */
const StepRow = ({
  call,
  typing,
  markdownComponents,
}: {
  call: AiToolCall;
  typing: boolean;
  markdownComponents?: Components;
}) => {
  const label = stepLabel(call);
  const { shown, done } = useTypedText(label, typing);
  const icon = call.ok ? (
    <Icons.CheckCircleOutlined iconSize="s" css={statusIcon} />
  ) : (
    <Icons.CloseCircleOutlined iconSize="s" css={statusIcon} />
  );

  if (!done) {
    return (
      <TypingRow aria-live="polite">
        {icon}
        <StepName>{shown}</StepName>
      </TypingRow>
    );
  }

  return (
    <Step>
      <summary>
        {icon}
        {/* The snake_case identifier, not a prettified label: it is what appears
            in the logs and in a bug report, so it is the version worth being
            able to quote. */}
        <StepName>{call.name}</StepName>
        <Muted>
          {[
            summariseOutcome(call),
            call.durationMs === undefined
              ? ''
              : t('%sms', String(call.durationMs)),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Muted>
      </summary>
      <StepDetail call={call} markdownComponents={markdownComponents} />
    </Step>
  );
};

export interface ThoughtProcessProps {
  /** The model's own reasoning, rendered as markdown. */
  reasoning?: string;
  /** What the assistant was told about the user's screen, as it was sent. */
  pageContext?: string;
  /** Steps taken, in order. */
  toolCalls?: AiToolCall[];
  /** The transcript's markdown components, so SQL inside a step behaves the same
   * as SQL inside an answer. */
  markdownComponents?: Components;
  /**
   * Whether to start open. True while a run is in flight, so the steps are
   * visible as they happen; false for a finished turn, where the answer is the
   * point and the record is there if wanted. Only the initial state — the user
   * can always close it, and closing it sticks.
   */
  defaultOpen?: boolean;
  /** Type each new step's line in as it arrives. Live runs only. */
  typewriter?: boolean;
}

/**
 * The collapsed record of how a turn was answered.
 *
 * Renders nothing at all when there is neither reasoning nor a step, so a plain
 * answer is not followed by an empty disclosure the user can open to find
 * nothing — which is what a bare "Thought process" row on a tool-free reply
 * looked like.
 */
export const ThoughtProcess = ({
  reasoning,
  pageContext,
  toolCalls,
  markdownComponents,
  defaultOpen = false,
  typewriter = false,
}: ThoughtProcessProps) => {
  const steps = toolCalls ?? [];
  const trimmedReasoning = reasoning?.trim();
  const trimmedContext = pageContext?.trim();
  const failures = useMemo(
    () => steps.filter(step => !step.ok).length,
    [steps],
  );

  // Held rather than left to the DOM's own `open` attribute, so that a user who
  // closes it during a run is not re-opened by the next re-render — and there is
  // one on every streamed frame.
  const [open, setOpen] = useState(defaultOpen);

  // `defaultOpen` is not only an initial value: it flips when a run ends and the
  // finished message becomes the one whose detail should stay open, and flips
  // back when a later turn takes that role. `useState` alone ignores both, so the
  // section stayed shut exactly when it mattered. Following the prop does mean a
  // manually-opened older message closes when a new turn arrives, which is the
  // lesser surprise of the two.
  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  if (!trimmedReasoning && !trimmedContext && steps.length === 0) {
    return null;
  }

  // The summary states the shape of the work before it is opened, because that
  // is often the whole question: "did it actually query anything?"
  const parts: string[] = [t('Thought process')];
  if (steps.length > 0) {
    parts.push(t('%s step(s)', String(steps.length)));
  }
  if (failures > 0) {
    parts.push(t('%s failed', String(failures)));
  }

  return (
    <Section
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
      data-test="chat-thought-process"
    >
      <summary>{parts.join(' · ')}</summary>

      {trimmedReasoning && (
        <Reasoning>
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={REMARK_PLUGINS}
          >
            {trimmedReasoning}
          </ReactMarkdown>
        </Reasoning>
      )}

      {trimmedContext && (
        <Step>
          <summary>
            <Icons.EyeOutlined iconSize="s" css={statusIcon} />
            <StepName>{t('Context used')}</StepName>
            <Muted>{t('what the assistant could see on your screen')}</Muted>
          </summary>
          <StepBody>
            {/* Shown as text rather than markdown: this is the prompt section
                verbatim, and rendering it would reflow the headings the model
                was given into the panel's own heading styles. */}
            <Code>{trimmedContext}</Code>
          </StepBody>
        </Step>
      )}

      {steps.map((call, index) => (
        <StepRow
          // A tool can legitimately be called twice with the same arguments, so
          // the name alone is not unique within a turn; position is.
          // eslint-disable-next-line react/no-array-index-key
          key={`${call.name}-${index}`}
          call={call}
          // Only the newest line types. An earlier one that was still mid-word
          // when the next step arrived completes immediately, so the list never
          // has two lines animating at once.
          typing={typewriter && index === steps.length - 1}
          markdownComponents={markdownComponents}
        />
      ))}
    </Section>
  );
};

export default ThoughtProcess;
