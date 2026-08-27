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
import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import {
  Button,
  EmptyState,
  Form,
  Input,
  Loading,
  Tabs,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import copyTextToClipboard from 'src/utils/copy';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';
import { widgetLabel } from 'src/core/dashboard/widgetLabel';
import DashboardProperties from './DashboardProperties';
import PropsForm from './PropsForm';
import { useSchemaControlledWidgetTypes } from './schemaControlledWidgets';
import {
  commitWidgetProps,
  describeError,
  type ControlValidationError,
} from './controlValueValidation';

// Lazy so the JSONForms / semanticLayers graph the schema-driven control panel
// pulls in stays out of the eagerly-loaded Inspector bundle (the same
// core->features cycle that otherwise surfaces app-wide as `t is not a
// function`). Loaded only when a schema-controlled widget is selected; the
// dependency-free `schemaControlledWidgets` decides membership.
const SchemaControlPanel = lazy(() => import('./SchemaControlPanel'));

/**
 * A group of fields, and where one stops.
 *
 * The panel is a single column that can run several screens deep, and the
 * headings alone were doing all the work of dividing it — set at the same
 * weight as the field labels beneath them, they read as one more label rather
 * than as the top of a group. The rule above each section is what actually
 * separates them; the heading is bolder so a scan finds it first.
 */
const Group = styled.section`
  ${({ theme }) => css`
    margin-top: ${theme.sizeUnit * 4}px;
    padding-top: ${theme.sizeUnit * 4}px;
    border-top: 1px solid ${theme.colorSplit};
  `}
`;

/**
 * At the size the fields under it are labelled, and heavier.
 *
 * Smaller and greyer than the labels it introduces, a section heading reads as
 * a caption belonging to the field above rather than as the top of the group
 * below — the hierarchy inverted, with "Content" the section set in less than
 * "Content" the field. Weight carries the difference instead, with the rule
 * above doing the separating.
 */
const GroupTitle = styled.h4`
  ${({ theme }) => css`
    margin: 0 0 ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

/** What is selected, named the way the canvas and the Outline name it. */
const IdentityName = styled.h3`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
    overflow-wrap: anywhere;
  `}
`;

const IdentityMeta = styled.p`
  ${({ theme }) => css`
    margin: ${theme.sizeUnit}px 0 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
    word-break: break-all;
  `}
`;

const Section = ({
  title,
  test,
  children,
}: {
  title: string;
  test: string;
  children: ReactNode;
}): ReactElement => (
  <Group data-test={test}>
    <GroupTitle>{title}</GroupTitle>
    {children}
  </Group>
);

/**
 * Widget types whose renderer reads a plain-text `content` prop.
 *
 * A convenience over the general props editor below, not a special case in
 * the render path: prose is miserable to write inside a JSON string, with
 * every newline escaped and every quote doubled. Anything not named here is
 * still fully authorable — through the editor that knows no types at all.
 */
const PLAIN_TEXT_CONTENT = new Set(['markdown']);

/** The `content` a widget renders, edited where it is displayed. */
const ContentField = ({
  nodeId,
  content,
}: {
  nodeId: string;
  content: string;
}): ReactElement => {
  const theme = useTheme();
  const [draft, setDraft] = useState(content);
  // What was accepted replaces the draft, because the draft was a view of it:
  // an edit made by the assistant while this panel is open has to show.
  useEffect(() => setDraft(content), [content, nodeId]);

  return (
    // "Text", not "Content": the section this sits in is already called
    // Content, and the two stacked read as the same word said twice. What the
    // box holds is prose, which is what the label should say.
    <Form.Item label={t('Text')} style={{ marginBottom: theme.sizeUnit * 2 }}>
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

/** Long enough to be read, short enough not to outlast the glance at it. */
const COPIED_FOR_MS = 1500;

/**
 * Everything a widget renders from, offered whole and as text.
 *
 * This is the general answer to "how do I give this widget its content", and
 * it is general on purpose: a chart's `dataBinding` and `echartsOptions`, a
 * table's `columnDefs`, and whatever an extension's widget reads next year
 * are all just keys here. A form per widget type would need this panel to
 * learn every type — the exact knowledge `WidgetView` is built not to
 * have, and what `PropsForm` generates a form without needing.
 *
 * This half is where the *shape* is decided, which is why it survives having
 * a form beside it: a key that does not exist yet has no field, and can only
 * be added by writing it.
 *
 * The draft is held until it parses and the author asks for it, so malformed
 * JSON never reaches a widget. What is applied is the whole record: keys the
 * author deleted are sent as `undefined`, which is as close to a removal as
 * a merge can express — the widget reads `undefined` either way, and the key
 * does not survive the next serialization back into this editor. Without
 * that, deleting a line here would silently do nothing and the widget would
 * go on rendering from the value it appeared to lose.
 *
 * For a schema-controlled widget type, applying goes through the same
 * `commitWidgetProps` validation gate the Form tab's edits do — one
 * candidate, one gate, regardless of which tab wrote it — so Apply can
 * reject a change and leave both the draft and the stored node as they were.
 * A widget type with no backend schema has no gate to validate against, so
 * it keeps committing straight to the store, as it always has; conflating
 * the two would mean either inventing a schema that does not exist or
 * silently skipping validation while claiming to enforce it.
 */
const PropsJsonEditor = ({
  nodeId,
  widgetType,
  validated,
  props,
}: {
  nodeId: string;
  widgetType: string;
  validated: boolean;
  props: Record<string, unknown> | undefined;
}): ReactElement => {
  const theme = useTheme();
  const accepted = format(props);
  const [draft, setDraft] = useState(accepted);
  useEffect(() => setDraft(accepted), [accepted, nodeId]);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    ControlValidationError[]
  >([]);
  useEffect(() => setValidationErrors([]), [nodeId]);

  // Reverts on its own so the control goes back to offering the copy rather
  // than reporting one indefinitely, and on any edit, because a tick beside
  // text that has since changed is a tick about the wrong text.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_FOR_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => setCopied(false), [draft]);
  // A validation error is about the candidate it was raised for; further
  // typing makes it stale, and Apply will re-raise it if it still applies.
  useEffect(() => setValidationErrors([]), [draft]);

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
      {/* Named by the tab it is on, so the label says what these are rather
          than repeating how they are being written. */}
      <Form.Item
        label={t('Properties')}
        style={{ marginBottom: theme.sizeUnit * 2 }}
      >
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
      {validationErrors.map(err => (
        <p
          key={`${err.loc.join('.')}:${err.message}`}
          data-test="inspector-props-validation-error"
          style={{
            margin: `0 0 ${theme.sizeUnit}px`,
            fontSize: theme.fontSizeSM,
            color: theme.colorErrorText,
          }}
        >
          {err.loc.length > 0 ? `${err.loc.join('.')}: ` : ''}
          {err.message}
        </p>
      ))}
      <div style={{ display: 'flex', gap: theme.sizeUnit }}>
        <Button
          buttonSize="xsmall"
          buttonStyle="primary"
          data-test="inspector-props-apply"
          disabled={parsed === undefined || !dirty || submitting}
          onClick={async () => {
            if (parsed === undefined) {
              return;
            }
            const removed = Object.keys(props ?? {}).filter(
              key => !(key in parsed!),
            );
            const delta = {
              ...parsed,
              ...Object.fromEntries(removed.map(key => [key, undefined])),
            };
            if (!validated) {
              provider.updateProps(nodeId, delta);
              return;
            }
            setSubmitting(true);
            try {
              const result = await commitWidgetProps(nodeId, widgetType, delta);
              setValidationErrors(result.ok ? [] : result.errors);
            } catch (e) {
              const message = await describeError(e);
              setValidationErrors([{ loc: [], message }]);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {t('Apply')}
        </Button>
        {/* `secondary` beside the primary Apply — the pairing this app uses
            wherever one button commits and the one next to it does not. Two
            `primary` buttons side by side say both are the thing to press. */}
        <Button
          buttonSize="xsmall"
          buttonStyle="secondary"
          data-test="inspector-props-revert"
          disabled={!dirty}
          onClick={() => setDraft(accepted)}
        >
          {t('Revert')}
        </Button>
        {/* Set apart from the two beside it, because it is not one of them:
            those commit what is in the box and this only takes a copy of it.
            The draft rather than what the widget holds, so what is copied is
            what is on screen — including an edit not applied yet.
            Confirmed in place: a panel this narrow has nowhere to put a
            message, and a copy that says nothing leaves you pressing it
            again to be sure. */}
        <Button
          buttonSize="xsmall"
          buttonStyle="link"
          data-test="inspector-props-copy"
          aria-label={t('Copy properties as JSON')}
          tooltip={copied ? t('Copied') : t('Copy properties as JSON')}
          placement="bottom"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            copyTextToClipboard(() => Promise.resolve(draft));
            setCopied(true);
          }}
        >
          {copied ? (
            <Icons.CheckOutlined iconSize="s" />
          ) : (
            <Icons.CopyOutlined iconSize="s" />
          )}
        </Button>
      </div>
    </>
  );
};

/**
 * The two ways into one set of properties.
 *
 * They are not alternatives so much as halves. The JSON side is the whole
 * record as text: it is the only one that can add a key or drop one, and the
 * only one that can express a value no field knows how to hold. The form side
 * is generated from the values that are already there (see
 * `inferPropsSchema`), so it cannot invent a key — but it is where a value is
 * actually filled in, with a control that suits its type instead of quoting
 * and escaping inside a string.
 *
 * The form comes first and is what the panel opens on: it is the half that
 * asks a question rather than handing over a record to edit, and most of what
 * an author does here is change a value that already exists. The one case it
 * cannot serve — a widget placed a moment ago, with no properties and so no
 * fields — says so and names the tab that can, rather than leaving a blank
 * pane that reads as broken.
 *
 * Only the JSON half is wrapped in an antd `Form`, and the asymmetry is load
 * bearing rather than an oversight. The generated controls render their own
 * `Form.Item name={...}`, and an antd `Form` above them binds those items to
 * its store — which means antd supplies the `value` and the `onChange`,
 * overriding the ones JsonForms passed. The field still accepts typing; the
 * edit just goes into a form store nothing reads instead of into the widget.
 * `SemanticLayerModal` renders JsonForms under a plain `<form>` element for
 * the same reason.
 */
const PropsEditor = ({
  nodeId,
  widgetType,
  props,
  formOmitKeys,
}: {
  nodeId: string;
  widgetType: string;
  props: Record<string, unknown> | undefined;
  // Keys the generic form must not offer because a dedicated control above it
  // already edits them (e.g. `content`, owned by the Text editor). Omitted from
  // the Form tab only — the JSON tab still shows the whole record.
  formOmitKeys?: readonly string[];
}): ReactElement => {
  const theme = useTheme();
  // Set down from the tab bar, the same step the panel and the palette take
  // from theirs. Flush against it, whichever label comes first reads as a
  // caption belonging to the tabs rather than as the head of the field under
  // it — and on the JSON side that label is the one word saying what the box
  // beneath it holds.
  const inset = { paddingTop: theme.sizeUnit * 3 };

  // A schema-controlled widget draws its Form tab from a backend-served JSON
  // Schema (rendered bare — see the note above on why JsonForms must not sit
  // under an antd `Form`); every other widget falls back to the generic
  // value-inferred `PropsForm`. Which types are schema-controlled is derived
  // from the backend (`useSchemaControlledWidgetTypes`), so adding a widget
  // type needs no frontend edit. Both write to the same `node.props`, and the
  // JSON tab is identical for all widgets.
  //
  // The generic form drops `formOmitKeys` so it doesn't re-offer a value a
  // dedicated control already edits (a single-line input mirroring the Text
  // area above it). `updateProps` merges, so a key absent from the form's data
  // is left untouched rather than removed.
  const schemaControlledTypes = useSchemaControlledWidgetTypes();
  const validated = schemaControlledTypes?.has(widgetType) ?? false;
  const formProps =
    formOmitKeys && formOmitKeys.length > 0 && props
      ? Object.fromEntries(
          Object.entries(props).filter(([key]) => !formOmitKeys.includes(key)),
        )
      : props;
  let formTab: ReactNode;
  if (schemaControlledTypes === null) {
    // The backend list is still loading — show a spinner rather than briefly
    // rendering the wrong control (generic form for a schema-driven widget).
    formTab = <Loading position="inline-centered" size="s" />;
  } else if (schemaControlledTypes.has(widgetType)) {
    formTab = (
      <Suspense fallback={<Loading position="inline-centered" size="s" />}>
        <SchemaControlPanel nodeId={nodeId} />
      </Suspense>
    );
  } else {
    formTab = <PropsForm nodeId={nodeId} props={formProps} />;
  }

  return (
    <Tabs
      size="small"
      defaultActiveKey="form"
      data-test="inspector-props-tabs"
      items={[
        {
          key: 'form',
          label: t('Form'),
          children: <div style={inset}>{formTab}</div>,
        },
        {
          key: 'json',
          label: t('JSON'),
          children: (
            <Form
              layout="vertical"
              component="div"
              style={inset}
              data-test="inspector-props-json"
            >
              <PropsJsonEditor
                nodeId={nodeId}
                widgetType={widgetType}
                validated={validated}
                props={props}
              />
            </Form>
          ),
        },
      ]}
    />
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

  // Set down from the tab bar above, and in from the rail's own edges.
  // Whatever comes first here — the identity of what is selected, or the
  // line saying nothing is — reads as a caption hanging off the tabs when it
  // starts flush against them; every field below inherits this same inset,
  // since none of them supply their own horizontal padding.
  const inset = {
    paddingTop: theme.sizeUnit * 3,
    paddingLeft: theme.sizeUnit * 3,
    paddingRight: theme.sizeUnit * 3,
  };

  if (!node) {
    return (
      <div data-test="inspector-empty" style={inset}>
        <EmptyState
          size="small"
          image="empty.svg"
          title={t('Nothing selected')}
          description={t(
            'Pick a widget on the canvas, or a row in the Outline, to edit it here.',
          )}
        />
      </div>
    );
  }

  // The root is the dashboard rather than a widget on it, so what it is asked
  // for is different in kind: what it is called, who it belongs to, how it
  // looks — not where it sits or what it renders.
  const isRoot = node.id === provider.getRoot().id;
  const content = node.props?.content;
  // Offered for a widget whose renderer reads prose, whether or not it has
  // any yet — a markdown widget placed a moment ago has no props at all, and
  // waiting for a `content` key to exist before showing the field is what
  // left it with no way to be given one.
  const takesText =
    typeof content === 'string' || PLAIN_TEXT_CONTENT.has(node.type);

  return (
    <div data-test="inspector" style={{ ...inset, fontSize: theme.fontSizeSM }}>
      {isRoot ? (
        <DashboardProperties />
      ) : (
        // The same shape the dashboard's own panel opens with: what this is,
        // then the smaller print about it. The name is `widgetLabel`'s — the
        // one the canvas header and the Outline row already use — so a widget
        // is called one thing in all three places, and the type and id sit
        // under it as what they are, a fact about the widget rather than its
        // name.
        <div data-test="inspector-identity">
          <IdentityName>{widgetLabel(node.type, node.props)}</IdentityName>
          <IdentityMeta>
            {node.type} · {node.id}
          </IdentityMeta>
        </div>
      )}

      {/* Outside the `Form` below, and each half of it wrapping its own —
          the generated form must not have an antd `Form` above it. See
          `PropsEditor`. */}
      {!isRoot && (
        <Section title={t('Content')} test="inspector-section-content">
          {takesText && (
            <Form layout="vertical" component="div">
              <ContentField
                nodeId={node.id}
                content={typeof content === 'string' ? content : ''}
              />
            </Form>
          )}
          <PropsEditor
            nodeId={node.id}
            widgetType={node.type}
            props={node.props}
            // The Text editor above already owns `content` for a text widget, so
            // the generic form drops it rather than showing a single-line input
            // mirroring that textarea.
            formOmitKeys={takesText ? ['content'] : undefined}
          />
        </Section>
      )}
    </div>
  );
}
