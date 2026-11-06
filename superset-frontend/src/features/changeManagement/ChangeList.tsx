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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { ago, hasDetail, show } from './display';
import type { EntryChange, FieldChange, LayoutComponent } from './types';

/**
 * The reviewer's list of what a change touches, one block per field.
 *
 * Every block is drawn from what the server sent for that field, in this
 * order: the layout components, the entries that moved inside a structured
 * field, the two sides of a collection, the field's top-level keys, and
 * finally its before and after. A field that arrives with none of them is
 * said to be unreadable rather than drawn as a bare "Changed" -- and the
 * server does not send one, because the gate counted the field and the
 * server shows every field the gate counts from its two values.
 */

const FieldBlock = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 2}px 0;
    border-bottom: 1px dashed ${theme.colorSplit};
    &:last-of-type { border-bottom: none; }
  `}
`;

const FieldName = styled.div`
  ${({ theme }) => `
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
    margin-bottom: ${theme.sizeUnit}px;
  `}
`;

const Before = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    text-decoration: line-through;
    word-break: break-word;
  `}
`;

const After = styled.div`
  ${({ theme }) => `
    color: ${theme.colorSuccessText};
    word-break: break-word;
  `}
`;

const Muted = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
  `}
`;

const EntryRow = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit}px 0;
    word-break: break-word;
  `}
`;

const Summary = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
    margin-bottom: ${theme.sizeUnit}px;
    word-break: break-word;
  `}
`;

/** The request as it was captured: monospaced, wrapped, not interpreted. */
const Raw = styled.pre`
  ${({ theme }) => `
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeSM}px;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    color: ${theme.colorText};
  `}
`;

const Unshown = styled.div`
  ${({ theme }) => `
    color: ${theme.colorWarningText};
    word-break: break-word;
  `}
`;

const Blocked = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    margin-bottom: ${theme.sizeUnit * 3}px;
    background: ${theme.colorWarningBg};
    border: 1px solid ${theme.colorWarningBorder};
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorText};
    word-break: break-word;
  `}
`;

const EntryKey = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

/** The recalculated settings, set apart from the edit that caused them. */
const ConsequenceGroup = styled.div`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 2}px;
    padding-top: ${theme.sizeUnit * 2}px;
    border-top: 1px dotted ${theme.colorSplit};
  `}
`;

const Toggle = styled.button`
  ${({ theme }) => `
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorPrimary};
    &:hover { text-decoration: underline; }
  `}
`;

/**
 * What a reviewer calls these, rather than what the column is called.
 *
 * `params` and `json_metadata` are storage names; a reviewer deciding
 * whether to publish a change should not have to know them (129075).
 *
 * A convenience and not a gate: a field with no entry here is shown under
 * its own name, with its values.
 */
const FIELD_LABELS: Record<string, string> = {
  slice_name: t('Title'),
  dashboard_title: t('Title'),
  table_name: t('Name'),
  description: t('Description'),
  params: t('Chart configuration'),
  query_context: t('Query'),
  json_metadata: t('Dashboard settings'),
  position_json: t('Layout'),
  css: t('Stylesheet'),
  published: t('Published'),
  cache_timeout: t('Cache timeout'),
  owners: t('Owners'),
  editors: t('Editors'),
  viewers: t('Viewers'),
  tags: t('Tags'),
  dashboards: t('Dashboards'),
  theme_id: t('Theme'),
  datasource_id: t('Dataset'),
  sql: t('SQL'),
  archived: t('Archive status'),
  version: t('Restore to version'),
  embedding: t('Embedding'),
  embedding_allowed_domains: t('Domains allowed to embed'),
  native_filter_configuration: t('Native filters'),
  chart_customization_config: t('Chart customizations'),
  label_colors: t('Label colors'),
};

export const fieldLabel = (field: string): string => FIELD_LABELS[field] ?? field;

const KIND_LABEL: Record<EntryChange['kind'], string> = {
  added: t('Added'),
  removed: t('Removed'),
  changed: t('Changed'),
};

/**
 * A path inside a structured field, with its first segment relabelled.
 * Only the leading control name is in the labels; the rest of the path is the
 * setting's own nesting and keeps its names.
 */
function entryLabel(key: string, labels: Record<string, string>): string {
  const [head, ...rest] = key.split('.');
  return [labels[head] ?? head, ...rest].join('.');
}

function componentLine(component: LayoutComponent): string {
  const what = component.name
    ? `${component.type.toLowerCase()}: ${component.name}`
    : component.type.toLowerCase();
  const notes = [
    ...(component.moved ? [t('moved')] : []),
    ...(component.details ?? []),
  ];
  return notes.length ? `${what} (${notes.join('; ')})` : what;
}

/**
 * What the layout list below it adds up to, counted from that list.
 *
 * The server also sends `added`, `removed` and `changed`, but those count the
 * layout's *elements* whose JSON differs, rows and columns included, while the
 * list names components. A row that gained a chart was "1 moved" over a list
 * with no move in it (R5-03). A number a reviewer cannot find in the list
 * beneath it makes them doubt the list, so the header is now nothing but the
 * list's own length, by kind: each row is counted exactly once.
 */
export function layoutTally(components: LayoutComponent[]): string {
  const added = components.filter(c => c.kind === 'added').length;
  const removed = components.filter(c => c.kind === 'removed').length;
  const moved = components.filter(c => c.kind === 'changed' && c.moved).length;
  const edited = components.filter(c => c.kind === 'changed' && !c.moved).length;
  return [
    added ? t('%s added', added) : '',
    removed ? t('%s removed', removed) : '',
    moved ? t('%s moved', moved) : '',
    edited ? t('%s edited', edited) : '',
  ]
    .filter(Boolean)
    .join(', ');
}

function Entries({
  entries,
  more,
  labels,
}: {
  entries: EntryChange[];
  more?: number;
  labels: Record<string, string>;
}) {
  return (
    <>
      {entries.map(entry => (
        <EntryRow
          key={`${entry.kind}-${entry.key}`}
          data-test="change-entry"
        >
          <EntryKey>
            {entry.kind === 'changed'
              ? entryLabel(entry.key, labels)
              : `${KIND_LABEL[entry.kind]} · ${entryLabel(entry.key, labels)}`}
          </EntryKey>
          {entry.kind !== 'added' && entry.before !== undefined ? (
            <Before>{show(entry.before)}</Before>
          ) : null}
          {entry.kind !== 'removed' && entry.after !== undefined ? (
            <After>{show(entry.after)}</After>
          ) : null}
          {entry.truncated ? (
            <Muted>{t('Shortened to fit. Open the asset to read it in full.')}</Muted>
          ) : null}
        </EntryRow>
      ))}
      {/* Only ever said about entries that are missing from the list above.
          The server sends every entry, so this is the client declining to
          let a partial list read as the whole change. */}
      {more ? (
        <Unshown data-test="entries-not-sent">
          {t(
            '%s further entries were not sent with this request. Open the asset to read them.',
            more,
          )}
        </Unshown>
      ) : null}
    </>
  );
}

/**
 * Settings Superset recalculated because of the edit, under the line that says
 * why.
 *
 * Deleting one chart rewrote the list of charts in every filter's scope, and
 * those lists, printed in full, buried the deletion. They are real changes, so
 * they are not dropped: the sentence is always visible, and one click opens
 * every list that moved, by name.
 */
function Consequences({
  summary,
  entries,
  labels,
  name = 'consequence',
}: {
  summary?: string;
  entries: EntryChange[];
  labels: Record<string, string>;
  /** Which group this is, for the test ids. */
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ConsequenceGroup data-test={`${name}-group`}>
      <Summary data-test={`${name}-summary`}>
        {summary ?? t('Settings Superset recalculated because of this edit')}
      </Summary>
      <Toggle
        type="button"
        aria-expanded={open}
        data-test={`${name}-toggle`}
        onClick={() => setOpen(wasOpen => !wasOpen)}
      >
        {open
          ? t('Hide details (%s)', entries.length)
          : t('Show details (%s)', entries.length)}
      </Toggle>
      {open ? <Entries entries={entries} labels={labels} /> : null}
    </ConsequenceGroup>
  );
}

export interface ChangeBlockProps {
  change: FieldChange;
  /** Explore's labels for the keys inside a chart's `params`. */
  controls?: Record<string, string>;
}

export function ChangeBlock({ change, controls }: ChangeBlockProps) {
  const labels = change.field === 'params' && controls ? controls : {};
  const entries = change.entries ?? [];
  // What the author edited, what the editor wrote down for the first time,
  // and what Superset recalculated because of it.
  //
  // The middle group is why this split exists. Edit mode and Explore post
  // every setting they know about, so the first save of anything older
  // than the current editor arrives carrying dozens the stored blob never
  // held, at their own defaults. Listed flat they buried the one real edit
  // (129075). None is dropped; they are one click away.
  const consequences = entries.filter(entry => entry.consequence);
  const edits = entries.filter(
    entry => !entry.consequence && !entry.first_time,
  );
  const firstTime = entries.filter(
    entry => !entry.consequence && entry.first_time,
  );
  const isCollection = change.count !== undefined;
  const hasPair = change.before !== undefined || change.after !== undefined;

  return (
    <FieldBlock data-test={`change-${change.field}`}>
      <FieldName>{fieldLabel(change.field)}</FieldName>

      {/* What approving does because of a keyword, before the keyword's
          value: the mechanism is `name = value`, the consequence is this. */}
      {change.summary ? (
        <Summary data-test="change-summary">{change.summary}</Summary>
      ) : null}

      {change.layout ? (
        <>
          <Muted data-test="layout-tally">
            {(change.layout.components ?? []).length > 0
              ? layoutTally(change.layout.components ?? [])
              : t(
                  'The layout changed, but no chart, heading, tab or other component was added, removed or moved.',
                )}
          </Muted>
          {(change.layout.components ?? []).map((component, index) => (
            <EntryRow
              /* Two moved charts can share a title, and a swap names both. */
              // eslint-disable-next-line react/no-array-index-key
              key={`${index}-${component.kind}-${component.type}-${component.name ?? ''}`}
              data-test="layout-component"
            >
              <EntryKey>{KIND_LABEL[component.kind]}</EntryKey>
              {componentLine(component)}
            </EntryRow>
          ))}
          {change.layout.more ? (
            <Unshown data-test="entries-not-sent">
              {t(
                '%s further components were not sent with this request. Open the asset to read them.',
                change.layout.more,
              )}
            </Unshown>
          ) : null}
        </>
      ) : null}

      {/* The pair first, for a field that has one and also lists what moved
          inside it (a restore names its version, then what that version
          holds). A collection is its entries instead: its pair would only
          repeat them. */}
      {hasPair && !isCollection ? (
        <>
          {change.unreadable ? (
            <Raw data-test="captured-call">{show(change.after)}</Raw>
          ) : (
            <>
              {/* A keyword has a value and no "before": drawing a struck-out
                  dash for the missing side reads as a value being removed. */}
              {change.before !== undefined ? (
                <Before>{show(change.before)}</Before>
              ) : null}
              {change.after !== undefined ? (
                <After>{show(change.after)}</After>
              ) : null}
            </>
          )}
          {change.truncated ? (
            <Muted>{t('Shortened to fit. Open the asset to read it in full.')}</Muted>
          ) : null}
          {change.saved_at ? (
            <Muted>
              {change.saved_by
                ? t('Saved %s by %s', ago(change.saved_at), change.saved_by)
                : t('Saved %s', ago(change.saved_at))}
            </Muted>
          ) : null}
        </>
      ) : null}

      {entries.length > 0 ? (
        <>
          {isCollection && change.count ? (
            <Muted>
              {t(
                '%s before, %s after',
                change.count.before,
                change.count.after,
              )}
            </Muted>
          ) : null}
          {change.field === 'version' ? (
            // These are the edits that version's own save made, which is what
            // version history shows for it. They are not the difference
            // between the live asset and the restored one.
            <Muted>{t('What that version changed')}</Muted>
          ) : null}
          <Entries entries={edits} more={change.more} labels={labels} />
          {firstTime.length > 0 ? (
            <Consequences
              name="first-time"
              summary={t(
                'Settings written down for the first time by this save, at their existing values',
              )}
              entries={firstTime}
              labels={labels}
            />
          ) : null}
          {consequences.length > 0 ? (
            <Consequences
              summary={change.consequence_summary}
              entries={consequences}
              labels={labels}
            />
          ) : null}
        </>
      ) : isCollection && hasPair ? (
        // The same members in another order: nothing joined or left.
        <>
          <Before>{show(change.before)}</Before>
          <After>{show(change.after)}</After>
        </>
      ) : null}

      {/* Names without values are not a change a reviewer can judge. Every
          name is listed, none cut to a count, and the missing values are
          said to be missing rather than left to look like there were none.
          The server sends entries or a before and after for every field, so
          this is only reached by a response it did not write. */}
      {!hasDetail(change) ? (
        <>
          {(change.keys ?? []).map(key => (
            <EntryRow key={key} data-test="change-key">
              {entryLabel(key, labels)}
            </EntryRow>
          ))}
          <Unshown data-test="change-undescribed">
            {t(
              'The values for this change were not sent, so what it changes cannot be shown here.',
            )}
          </Unshown>
        </>
      ) : null}
    </FieldBlock>
  );
}

export interface ChangeListProps {
  changes: FieldChange[];
  controls?: Record<string, string>;
}

export default function ChangeList({ changes, controls }: ChangeListProps) {
  return (
    <>
      {changes.map(change => (
        <ChangeBlock
          key={`${change.keyword ? 'keyword:' : ''}${change.field}`}
          change={change}
          controls={controls}
        />
      ))}
    </>
  );
}

/**
 * Why a request cannot be approved from what is shown, said where the reviewer
 * is looking. Shown with the raw request beneath it, and with Approve withheld.
 */
export function BlockedNotice({ reason }: { reason: string }) {
  return (
    <Blocked role="alert" data-test="review-blocked">
      {reason}
    </Blocked>
  );
}
