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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { ago, show } from './display';
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

const Tag = styled.span`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

const EntryRow = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit}px 0;
    word-break: break-word;
  `}
`;

const EntryKey = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
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

/** "Title, metrics and 2 more" -- a list a person can read at a glance. */
export function summarise(
  keys: string[],
  labels: Record<string, string> = {},
): string {
  const named = keys.slice(0, 3).map(key => labels[key] ?? fieldLabel(key));
  const rest = keys.length - named.length;
  const list = named.join(', ');
  return rest > 0 ? t('%s and %s more', list, rest) : list;
}

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
      {more ? <Muted>{t('and %s more', more)}</Muted> : null}
    </>
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
  const isCollection = change.count !== undefined;
  const hasPair = change.before !== undefined || change.after !== undefined;
  const hasDetail =
    !!change.layout ||
    entries.length > 0 ||
    !!change.keys?.length ||
    hasPair;

  return (
    <FieldBlock data-test={`change-${change.field}`}>
      <FieldName>{fieldLabel(change.field)}</FieldName>

      {change.layout ? (
        <>
          <Muted>
            {t(
              '%s added, %s removed, %s moved',
              change.layout.added,
              change.layout.removed,
              change.layout.changed,
            )}
          </Muted>
          {(change.layout.components ?? []).map(component => (
            <EntryRow
              key={`${component.kind}-${component.type}-${component.name ?? ''}`}
              data-test="layout-component"
            >
              <EntryKey>{KIND_LABEL[component.kind]}</EntryKey>
              {componentLine(component)}
            </EntryRow>
          ))}
          {change.layout.more ? (
            <Muted>{t('and %s more', change.layout.more)}</Muted>
          ) : null}
        </>
      ) : null}

      {/* The pair first, for a field that has one and also lists what moved
          inside it (a restore names its version, then what that version
          holds). A collection is its entries instead: its pair would only
          repeat them. */}
      {hasPair && !isCollection ? (
        <>
          <Before>{show(change.before)}</Before>
          <After>{show(change.after)}</After>
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
          <Entries entries={entries} more={change.more} labels={labels} />
        </>
      ) : isCollection && hasPair ? (
        // The same members in another order: nothing joined or left.
        <>
          <Before>{show(change.before)}</Before>
          <After>{show(change.after)}</After>
        </>
      ) : null}

      {change.added_keys ? (
        <Muted>
          {t('%s further settings written for the first time', change.added_keys)}
        </Muted>
      ) : null}

      {!change.layout && entries.length === 0 && change.keys?.length ? (
        <Muted>{summarise(change.keys, labels)}</Muted>
      ) : null}

      {!hasDetail ? <Tag>{t('Changed')}</Tag> : null}
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
        <ChangeBlock key={change.field} change={change} controls={controls} />
      ))}
    </>
  );
}
