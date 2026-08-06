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
import {
  Button,
  Form,
  Input,
  InputNumber,
  Radio,
  Switch,
  Tabs,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import copyTextToClipboard from 'src/utils/copy';
import { provider, useDashboardRevision } from 'src/core/dashboard/store';
import { resolveLayoutMode } from 'src/core/dashboard/layoutStyle';
import DashboardProperties from './DashboardProperties';
import LayoutModeSwitcher from './LayoutModeSwitcher';
import PropsForm from './PropsForm';

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

/**
 * Which fields a mode actually reads.
 *
 * A field the renderer ignores is worse than a missing one: it accepts a
 * value, writes it to the node, and changes nothing on screen — so an author
 * concludes the layout is broken rather than that the question did not apply.
 *
 * `columns`, `gap` and `rowUnit` are read by every mode, flex included, and
 * stay put: a flex line divides into `columns` parts and gives each child the
 * share its `colSpan` names (see `resolveFlexBasis`), spaces them by `gap`,
 * and sizes them off `rowUnit` (see `resolveFlexMetrics`).
 *
 * What differs is at the two ends. `col`/`row` are coordinates in a grid, and
 * a flex line has no cells to hold them — position there is `children` order,
 * which is why dragging in a flex canvas reorders rather than repositions.
 * And `direction`/`wrap`/`justify`/`align` are what a flex line has instead,
 * documented on `LayoutProps` as "flex only, ignored in every other mode" —
 * and until now not offered anywhere, so a flex canvas could be chosen and
 * then not actually arranged.
 */
const GRID_ONLY_PLACEMENT: ReadonlySet<keyof LayoutProps> = new Set([
  'col',
  'row',
]);

const FLEX_DIRECTIONS = [
  { value: 'row', label: t('Row') },
  { value: 'column', label: t('Column') },
];

const FLEX_JUSTIFY = [
  { value: 'start', label: t('Start') },
  { value: 'center', label: t('Center') },
  { value: 'end', label: t('End') },
  { value: 'space-between', label: t('Space between') },
  { value: 'space-around', label: t('Space around') },
];

const FLEX_ALIGN = [
  { value: 'stretch', label: t('Stretch') },
  { value: 'start', label: t('Start') },
  { value: 'center', label: t('Center') },
  { value: 'end', label: t('End') },
];

/**
 * One of a small fixed set, chosen where the choices can all be seen.
 *
 * `Radio.Group` rather than a dropdown, which is what `LayoutModeSwitcher`
 * already uses for the layout mode a few lines above these — and the shared
 * `Select` does not declare `value` or `size` among the antd props it
 * exposes, so driving one from the store would mean widening a type in a
 * package the rest of the app depends on.
 */
const ChoiceField = ({
  label,
  test,
  value,
  options,
  onChange,
}: {
  label: string;
  test: string;
  value: string;
  options: readonly { readonly value: string; readonly label: string }[];
  onChange: (next: string) => void;
}): ReactElement => {
  const theme = useTheme();
  return (
    <Form.Item label={label} style={{ marginBottom: theme.sizeUnit * 2 }}>
      <Radio.Group
        size="small"
        value={value}
        data-test={test}
        onChange={event => onChange(event.target.value as string)}
      >
        {options.map(option => (
          <Radio.Button key={option.value} value={option.value}>
            {option.label}
          </Radio.Button>
        ))}
      </Radio.Group>
    </Form.Item>
  );
};

/** The four a flex line is arranged by, and no other mode reads. */
const FlexFields = ({
  nodeId,
  layout,
}: {
  nodeId: string;
  layout: LayoutProps | undefined;
}): ReactElement => {
  const theme = useTheme();
  const set = (next: Partial<LayoutProps>) =>
    provider.updateLayout(nodeId, next);

  return (
    <>
      <ChoiceField
        label={t('Direction')}
        test="inspector-direction"
        value={layout?.direction ?? 'row'}
        options={FLEX_DIRECTIONS}
        onChange={next => set({ direction: next as LayoutProps['direction'] })}
      />
      <ChoiceField
        label={t('Justify')}
        test="inspector-justify"
        value={layout?.justify ?? 'start'}
        options={FLEX_JUSTIFY}
        onChange={next => set({ justify: next as LayoutProps['justify'] })}
      />
      <ChoiceField
        label={t('Align')}
        test="inspector-align"
        value={layout?.align ?? 'stretch'}
        options={FLEX_ALIGN}
        onChange={next => set({ align: next as LayoutProps['align'] })}
      />
      <Form.Item label={t('Wrap')} style={{ marginBottom: theme.sizeUnit * 2 }}>
        <Switch
          size="small"
          data-test="inspector-wrap"
          checked={layout?.wrap !== false}
          onChange={wrap => set({ wrap })}
        />
      </Form.Item>
    </>
  );
};

/**
 * The panel's own buttons, sized down.
 *
 * Everything here acts on one block, in a rail whose width is spent on the
 * fields rather than on the controls that commit them — and a panel of
 * full-height buttons reads as a row of decisions before you have read what
 * any of them apply to. Driven off the theme's smallest control step, the
 * same one the header's icon controls sit at, so the two rails agree.
 */
const minor = (theme: ReturnType<typeof useTheme>) => ({
  height: theme.controlHeightXS,
  paddingInline: theme.sizeUnit * 2,
  fontSize: theme.fontSizeSM,
  lineHeight: 1,
});

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
}): ReactElement => {
  const theme = useTheme();
  return (
    <Form.Item label={label} style={{ marginBottom: theme.sizeUnit * 2 }}>
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
};

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
  const theme = useTheme();
  const [draft, setDraft] = useState(content);
  // What was accepted replaces the draft, because the draft was a view of it:
  // an edit made by the assistant while this panel is open has to show.
  useEffect(() => setDraft(content), [content, nodeId]);

  return (
    <Form.Item
      label={t('Content')}
      style={{ marginBottom: theme.sizeUnit * 2 }}
    >
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
 * Which of its siblings a block is drawn over.
 *
 * A free canvas is the only place this can be asked. `react-grid-layout`
 * gives an overlapping child no `z-index` of its own, so the browser falls
 * back to tree order and the container's `children` order becomes the paint
 * order — the last child wins, and a block earlier in the array cannot be
 * put in front of a later one by moving it, resizing it, or selecting it.
 * That order was never something an author could see, let alone choose; this
 * is what turns it into something they can say.
 *
 * The two ends are the whole control on purpose. "Forward one" and "back
 * one" are the same call with an index arithmetic that only means anything
 * to someone already picturing the array, and the Outline is where a longer
 * stack is read and reordered.
 *
 * Every other mode arranges its children so they do not overlap, so there is
 * nothing to be in front of and the question does not arise.
 */
const StackingControls = ({ nodeId }: { nodeId: string }): ReactElement => {
  const theme = useTheme();
  return (
    <div style={{ display: 'flex', gap: theme.sizeUnit }}>
      <Button
        size="small"
        data-test="inspector-bring-to-front"
        style={minor(theme)}
        onClick={() => provider.bringToFront(nodeId)}
      >
        {t('Bring to front')}
      </Button>
      <Button
        size="small"
        data-test="inspector-send-to-back"
        style={minor(theme)}
        onClick={() => provider.sendToBack(nodeId)}
      >
        {t('Send to back')}
      </Button>
    </div>
  );
};

const format = (props: Record<string, unknown> | undefined): string =>
  JSON.stringify(props ?? {}, null, 2);

/** Long enough to be read, short enough not to outlast the glance at it. */
const COPIED_FOR_MS = 1500;

/**
 * Everything a block renders from, offered whole and as text.
 *
 * This is the general answer to "how do I give this block its content", and
 * it is general on purpose: a chart's `dataBinding` and `echartsOptions`, a
 * table's `columnDefs`, and whatever an extension's block reads next year
 * are all just keys here. A form per block type would need this panel to
 * learn every type — the exact knowledge `BuildingBlockView` is built not to
 * have, and what `PropsForm` generates a form without needing.
 *
 * This half is where the *shape* is decided, which is why it survives having
 * a form beside it: a key that does not exist yet has no field, and can only
 * be added by writing it.
 *
 * The draft is held until it parses and the author asks for it, so malformed
 * JSON never reaches a block. What is applied is the whole record: keys the
 * author deleted are sent as `undefined`, which is as close to a removal as
 * a merge can express — the block reads `undefined` either way, and the key
 * does not survive the next serialization back into this editor. Without
 * that, deleting a line here would silently do nothing and the block would
 * go on rendering from the value it appeared to lose.
 */
const PropsJsonEditor = ({
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
      <div style={{ display: 'flex', gap: theme.sizeUnit }}>
        <Button
          size="small"
          buttonStyle="primary"
          data-test="inspector-props-apply"
          style={minor(theme)}
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
          style={minor(theme)}
          disabled={!dirty}
          onClick={() => setDraft(accepted)}
        >
          {t('Revert')}
        </Button>
        {/* Set apart from the two beside it, because it is not one of them:
            those commit what is in the box and this only takes a copy of it.
            The draft rather than what the block holds, so what is copied is
            what is on screen — including an edit not applied yet.
            Confirmed in place: a panel this narrow has nowhere to put a
            message, and a copy that says nothing leaves you pressing it
            again to be sure. */}
        <Button
          size="small"
          buttonStyle="link"
          data-test="inspector-props-copy"
          aria-label={t('Copy properties as JSON')}
          tooltip={copied ? t('Copied') : t('Copy properties as JSON')}
          placement="bottom"
          style={{ ...minor(theme), marginLeft: 'auto' }}
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
 * cannot serve — a block placed a moment ago, with no properties and so no
 * fields — says so and names the tab that can, rather than leaving a blank
 * pane that reads as broken.
 *
 * Only the JSON half is wrapped in an antd `Form`, and the asymmetry is load
 * bearing rather than an oversight. The generated controls render their own
 * `Form.Item name={...}`, and an antd `Form` above them binds those items to
 * its store — which means antd supplies the `value` and the `onChange`,
 * overriding the ones JsonForms passed. The field still accepts typing; the
 * edit just goes into a form store nothing reads instead of into the block.
 * `SemanticLayerModal` renders JsonForms under a plain `<form>` element for
 * the same reason.
 */
const PropsEditor = ({
  nodeId,
  props,
}: {
  nodeId: string;
  props: Record<string, unknown> | undefined;
}): ReactElement => {
  const theme = useTheme();
  // Set down from the tab bar, the same step the panel and the palette take
  // from theirs. Flush against it, whichever label comes first reads as a
  // caption belonging to the tabs rather than as the head of the field under
  // it — and on the JSON side that label is the one word saying what the box
  // beneath it holds.
  const inset = { paddingTop: theme.sizeUnit * 3 };

  return (
    <Tabs
      size="small"
      defaultActiveKey="form"
      data-test="inspector-props-tabs"
      items={[
        {
          key: 'form',
          label: t('Form'),
          children: (
            <div style={inset}>
              <PropsForm nodeId={nodeId} props={props} />
            </div>
          ),
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
              <PropsJsonEditor nodeId={nodeId} props={props} />
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
  // The root is the dashboard rather than a block on it, so what it is asked
  // for is different in kind: what it is called, who it belongs to, how it
  // looks — not where it sits or what it renders. Arranging is the one thing
  // the two have in common, and it comes below as it does for any container.
  const isRoot = node.id === provider.getRoot().id;
  const parentId = provider.getParentId(node.id);
  const parent =
    parentId === undefined ? undefined : provider.getNode(parentId);
  // Only where children can overlap is there anything to be in front of.
  const stacks =
    parent !== undefined && resolveLayoutMode(parent.layout) === 'free';
  const content = node.props?.content;
  // Offered for a block whose renderer reads prose, whether or not it has
  // any yet — a markdown block placed a moment ago has no props at all, and
  // waiting for a `content` key to exist before showing the field is what
  // left it with no way to be given one.
  const takesText =
    typeof content === 'string' || PLAIN_TEXT_CONTENT.has(node.type);

  return (
    <div data-test="inspector" style={{ ...inset, fontSize: theme.fontSizeSM }}>
      {isRoot ? (
        <DashboardProperties />
      ) : (
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
          <PropsEditor nodeId={node.id} props={node.props} />
        </Section>
      )}

      {/* Labels above their fields: beside them halves the width left for the
          control, in the panel that most needs the room. */}
      <Form layout="vertical" component="div">
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
              {resolveLayoutMode(node.layout) === 'flex' && (
                <FlexFields nodeId={node.id} layout={node.layout} />
              )}
            </div>
          </Section>
        )}

        {/* The root is placed by nothing — it is what everything else is
            placed in — so it has no column, row or span of its own to set. */}
        {!isRoot && (
          <Section title={t('Placement')} test="inspector-section-placement">
            {CHILD_FIELDS.filter(
              field =>
                !(
                  parent !== undefined &&
                  resolveLayoutMode(parent.layout) === 'flex' &&
                  GRID_ONLY_PLACEMENT.has(field.key)
                ),
            ).map(field => (
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
            {stacks && <StackingControls nodeId={node.id} />}
          </Section>
        )}
      </Form>

      {/* `removeBuildingBlock` refuses the root, so offering it here would be
          a button that only ever raises. */}
      {!isRoot && (
        <Button
          size="small"
          danger
          data-test="inspector-delete"
          style={{ ...minor(theme), marginTop: theme.sizeUnit * 3 }}
          onClick={() => provider.removeBuildingBlock(node.id)}
        >
          {t('Delete')}
        </Button>
      )}
    </div>
  );
}
