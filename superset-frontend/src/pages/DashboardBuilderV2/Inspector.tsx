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

/** The `content` a markdown block renders, edited where it is displayed. */
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

  if (!node) {
    return (
      <p
        data-test="inspector-empty"
        style={{ color: theme.colorTextTertiary, fontSize: theme.fontSizeSM }}
      >
        {t('Select a block to edit its properties.')}
      </p>
    );
  }

  const isContainer = node.children !== undefined;
  const content = node.props?.content;

  return (
    <div data-test="inspector" style={{ fontSize: theme.fontSizeSM }}>
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
        {typeof content === 'string' && (
          <Section title={t('Content')} test="inspector-section-content">
            <ContentField nodeId={node.id} content={content} />
          </Section>
        )}

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
