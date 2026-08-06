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
import { useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { dashboard as dashboardApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { Button, Form, Input, InputNumber } from '@superset-ui/core/components';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';
import LayoutModeSwitcher from './LayoutModeSwitcher';

type LayoutProps = dashboardApi.LayoutProps;

/** Which layout fields belong to a container, and which to its child. */
const CONTAINER_FIELDS: readonly {
  readonly key: keyof LayoutProps;
  readonly label: string;
}[] = [
  { key: 'columns', label: t('Columns') },
  { key: 'gap', label: t('Gap') },
  { key: 'rowUnit', label: t('Row height') },
];

const CHILD_FIELDS: readonly {
  readonly key: keyof LayoutProps;
  readonly label: string;
}[] = [
  { key: 'colSpan', label: t('Width (columns)') },
  { key: 'rowSpan', label: t('Height (rows)') },
  { key: 'col', label: t('Start column') },
  { key: 'row', label: t('Start row') },
];

const Section = ({
  title,
  test,
  children,
}: {
  title: string;
  test: string;
  children: ReactNode;
}): ReactElement => {
  const theme = useTheme();
  return (
    <section data-test={test} style={{ marginTop: theme.sizeUnit * 4 }}>
      <h4
        style={{
          margin: `0 0 ${theme.sizeUnit * 2}px`,
          fontSize: theme.fontSizeSM,
          color: theme.colorTextSecondary,
        }}
      >
        {title}
      </h4>
      {children}
    </section>
  );
};

/**
 * A number that may be absent, and stays absent when cleared.
 *
 * Every one of these fields has a meaning for "not set" that differs from any
 * number: a child with no `col` is auto-placed, and a container with no
 * `columns` takes the default. Writing a zero when a field is emptied would
 * turn "let the grid decide" into "pin it at nothing".
 */
const NumberField = ({
  label,
  value,
  test,
  onChange,
}: {
  label: string;
  value: number | undefined;
  test: string;
  onChange: (next: number | undefined) => void;
}): ReactElement => (
  <Form.Item label={label} style={{ marginBottom: 8 }}>
    <InputNumber
      size="small"
      style={{ width: '100%' }}
      value={value ?? null}
      placeholder={t('Auto')}
      data-test={test}
      onChange={next => onChange(typeof next === 'number' ? next : undefined)}
    />
  </Form.Item>
);

/**
 * Block types whose renderer reads a plain-text `content` prop.
 *
 * A convenience over the general props editor below, not a special case in
 * the render path: prose is miserable to write inside a JSON string, with
 * every newline escaped and every quote doubled. Anything not named here is
 * still fully authorable — through the editor that knows no types at all.
 */
const PLAIN_TEXT_CONTENT = new Set(['markdown']);

/** The `content` a block renders, edited where it is displayed. */
const ContentField = ({
  nodeId,
  content,
}: {
  nodeId: string;
  content: string;
}): ReactElement => {
  const [draft, setDraft] = useState(content);
  // What was accepted replaces the draft, because the draft was a view of it:
  // an edit made by the assistant while this panel is open has to show.
  useEffect(() => setDraft(content), [content, nodeId]);

  return (
    <Form.Item label={t('Content')} style={{ marginBottom: 8 }}>
      <Input.TextArea
        size="small"
        rows={4}
        value={draft}
        data-test="inspector-content"
        onChange={event => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== content) {
            provider.updateProps(nodeId, { content: draft });
          }
        }}
      />
    </Form.Item>
  );
};

const format = (props: Record<string, unknown> | undefined): string =>
  JSON.stringify(props ?? {}, null, 2);

/**
 * Everything a block renders from, offered whole.
 *
 * This is the general answer to "how do I give this block its content", and
 * it is general on purpose: a chart's `dataBinding` and `echartsOptions`, a
 * table's `columnDefs`, and whatever an extension's block reads next year
 * are all just keys here. A form per block type would need this panel to
 * learn every type — the exact knowledge `BuildingBlockView` is built not to
 * have.
 *
 * The draft is held until it parses and the author asks for it, so malformed
 * JSON never reaches a block. What is applied is the whole record: keys the
 * author deleted are sent as `undefined`, which is as close to a removal as
 * a merge can express — the block reads `undefined` either way, and the key
 * does not survive the next serialization back into this editor. Without
 * that, deleting a line here would silently do nothing and the block would
 * go on rendering from the value it appeared to lose.
 */
const PropsEditor = ({
  nodeId,
  props,
}: {
  nodeId: string;
  props: Record<string, unknown> | undefined;
}): ReactElement => {
  const theme = useTheme();
  const accepted = format(props);
  const [draft, setDraft] = useState(accepted);
  useEffect(() => setDraft(accepted), [accepted, nodeId]);

  let parsed: Record<string, unknown> | undefined;
  let error: string | undefined;
  try {
    const value = JSON.parse(draft);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      error = t('Properties must be a JSON object.');
    } else {
      parsed = value as Record<string, unknown>;
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  const dirty = draft !== accepted;

  return (
    <>
      <Form.Item label={t('Properties (JSON)')} style={{ marginBottom: 8 }}>
        <Input.TextArea
          size="small"
          rows={8}
          value={draft}
          data-test="inspector-props"
          onChange={event => setDraft(event.target.value)}
        />
      </Form.Item>
      {error !== undefined && (
        <p
          data-test="inspector-props-error"
          style={{
            margin: `0 0 ${theme.sizeUnit}px`,
            fontSize: theme.fontSizeSM,
            color: theme.colorErrorText,
          }}
        >
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: theme.sizeUnit }}>
        <Button
          size="small"
          buttonStyle="primary"
          data-test="inspector-props-apply"
          disabled={parsed === undefined || !dirty}
          onClick={() => {
            if (parsed === undefined) {
              return;
            }
            const removed = Object.keys(props ?? {}).filter(
              key => !(key in parsed!),
            );
            provider.updateProps(nodeId, {
              ...parsed,
              ...Object.fromEntries(removed.map(key => [key, undefined])),
            });
          }}
        >
          {t('Apply')}
        </Button>
        <Button
          size="small"
          data-test="inspector-props-revert"
          disabled={!dirty}
          onClick={() => setDraft(accepted)}
        >
          {t('Revert')}
        </Button>
      </div>
    </>
  );
};

/**
 * Property editing over the selected node.
 *
 * Every field writes through `updateLayout`/`updateProps` — the same two
 * calls the AI client tools make — so a change made here and one asked for in
 * chat are the same edit arriving by different routes, and neither has a path
 * of its own to keep correct.
 *
 * The Inspector holds no state the store does not: what it shows is read on
 * each render, so an assistant edit updates it like anything else.
 */
export default function Inspector(): ReactElement {
  useDashboardRevision();
  const theme = useTheme();
  const selection = provider.getSelection();
  const node =
    selection === undefined ? undefined : provider.getNode(selection);

  // Set down from the tab bar above. Whatever comes first here — the
  // identity of what is selected, or the line saying nothing is — reads as a
  // caption hanging off the tabs when it starts flush against them.
  const inset = { paddingTop: theme.sizeUnit * 3 };

  if (!node) {
    return (
      <p
        data-test="inspector-empty"
        style={{
          ...inset,
          margin: 0,
          color: theme.colorTextTertiary,
          fontSize: theme.fontSizeSM,
        }}
      >
        {t('Select a block to edit its properties.')}
      </p>
    );
  }

  const isContainer = node.children !== undefined;
  const content = node.props?.content;
  // Offered for a block whose renderer reads prose, whether or not it has
  // any yet — a markdown block placed a moment ago has no props at all, and
  // waiting for a `content` key to exist before showing the field is what
  // left it with no way to be given one.
  const takesText =
    typeof content === 'string' || PLAIN_TEXT_CONTENT.has(node.type);

  return (
    <div data-test="inspector" style={{ ...inset, fontSize: theme.fontSizeSM }}>
      <p
        data-test="inspector-identity"
        style={{
          margin: 0,
          color: theme.colorTextSecondary,
          wordBreak: 'break-all',
        }}
      >
        {node.type} · {node.id}
      </p>

      {/* Labels above their fields: beside them halves the width left for the
          control, in the panel that most needs the room. */}
      <Form layout="vertical" component="div">
        <Section title={t('Content')} test="inspector-section-content">
          {takesText && (
            <ContentField
              nodeId={node.id}
              content={typeof content === 'string' ? content : ''}
            />
          )}
          <PropsEditor nodeId={node.id} props={node.props} />
        </Section>

        {isContainer && (
          <Section
            title={t('Arrangement')}
            test="inspector-section-arrangement"
          >
            <LayoutModeSwitcher nodeId={node.id} />
            <div style={{ marginTop: theme.sizeUnit * 3 }}>
              {CONTAINER_FIELDS.map(field => (
                <NumberField
                  key={field.key}
                  label={field.label}
                  test={`inspector-${field.key}`}
                  value={node.layout?.[field.key] as number | undefined}
                  onChange={next =>
                    provider.updateLayout(node.id, { [field.key]: next })
                  }
                />
              ))}
            </div>
          </Section>
        )}

        <Section title={t('Placement')} test="inspector-section-placement">
          {CHILD_FIELDS.map(field => (
            <NumberField
              key={field.key}
              label={field.label}
              test={`inspector-${field.key}`}
              value={node.layout?.[field.key] as number | undefined}
              onChange={next =>
                provider.updateLayout(node.id, { [field.key]: next })
              }
            />
          ))}
        </Section>
      </Form>

      <Button
        size="small"
        danger
        data-test="inspector-delete"
        style={{ marginTop: theme.sizeUnit * 3 }}
        onClick={() => provider.removeBuildingBlock(node.id)}
      >
        {t('Delete')}
      </Button>
    </div>
  );
}
