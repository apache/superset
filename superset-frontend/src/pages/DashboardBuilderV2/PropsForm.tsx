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
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { JsonForms } from '@jsonforms/react';
import { cellRegistryEntries } from '@great-expectations/jsonforms-antd-renderers';
import { renderers } from 'src/features/semanticLayers/jsonFormsHelpers';
import { provider } from 'src/core/dashboard/store';
import inferPropsSchema, { untypedKeys } from './inferPropsSchema';

/**
 * What a generated form is made to agree with.
 *
 * The controls come from a third-party renderer set, and it lays a form out
 * for a page of its own rather than for a rail beside a canvas. Four things
 * came out of it not matching the panel around them, and none of them can be
 * fixed at the call site because nothing here renders the controls:
 *
 * - a group's name arrives as a bare `b` with no size, weight or space of its
 *   own, so it read as the run-on end of the field above rather than as the
 *   head of the group below. It is given `Section`'s heading, which is what a
 *   group of fields is titled with everywhere else in this panel.
 * - controls are sized by what they hold: some carry `width: 100%`, some sit
 *   in an auto-width column. A column of fields that steps in and out down the
 *   panel reads as broken before it reads as compact, so they are all told to
 *   fill the column.
 * - what adds a row to an array sits in a list footer, which antd centres,
 *   while what deletes one is pushed right — so two controls doing the same
 *   kind of job to the same array sat at opposite ends of it. Both go left,
 *   where every other control in this rail starts.
 * - the buttons are antd's own default, which is `tertiary` in this app's
 *   terms and the right style for them; what they are not is the height the
 *   rest of the rail is at, and a form of full-height buttons inside a panel
 *   of small ones is the join showing.
 *
 * Scoped to this element rather than fixed in the renderers, which the
 * semantic-layer modal also draws from and which are not this change's to move
 * — the same reason `DashboardProperties` scopes its own input fix.
 *
 * Exported because `SchemaControlPanel` renders the same third-party renderer
 * set for schema-driven widgets and hits the identical four problems — the
 * Properties tab has two forms sharing one rail, and they read as one rhythm
 * only if they share this wrapper too.
 */
export const FormShell = styled.div`
  ${({ theme }) => css`
    /* A group's name, at the weight Section titles a group with. */
    > form > b,
    fieldset > b {
      display: block;
      margin: ${theme.sizeUnit * 4}px 0 ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSize}px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
    }

    /* One column, one width — but only for an array entry's own fields.

       An array entry's fields are handed to a grid meant for a page — two to
       a line, so a dimension came out half the width of the field above it.
       In a rail there is no second column to put anything in, so the grid is
       turned down its own axis and every cell given the width.

       Scoped to \`.ant-list-item\` (an entry) rather than to every Form.Item's
       control, because a scalar field can carry the identical Row/Col pair
       for a reason that has nothing to do with a page-width grid — a bounded
       number renders as a slider beside the figure it reads, and forcing
       that onto two full-width lines was this rule catching a control it was
       never aimed at. The form item's own label/control row is left alone
       either way: it is already a column in this layout, not a grid of
       entries. */
    .ant-list-item .ant-row:not(.ant-form-item-row) {
      flex-direction: column;
      align-items: stretch;
    }

    .ant-form-item-control-input-content > .ant-col,
    .ant-list-item .ant-row:not(.ant-form-item-row) > .ant-col {
      flex: 1 1 auto;
      min-width: 0;
      width: 100%;
      max-width: 100%;
    }

    .ant-input,
    .ant-input-number,
    .ant-picker,
    .ant-select {
      width: 100%;
    }

    /* One entry of an array: its fields down the column, and what removes it
       beneath them.

       antd lays a list item as a row and pushes its actions to the far end, so
       the fields of an entry shared the width with a Delete button and came
       out a hundred pixels narrower than the fields around them — the only
       reason "Column Name" sat short of "Dataset Id". Stacked, the fields get
       the column and the button falls under them at the start, which is where
       the other thing that acts on this array already is. */
    .ant-list-item {
      flex-direction: column;
      align-items: stretch;
      gap: ${theme.sizeUnit}px;
      padding-inline: 0;
    }

    /* Written at antd's own depth, and doubled.

       Two things have to be beaten here. antd indents the actions with
       margin-inline-start, which a physical margin-left does not compete with;
       and it says so through a selector wrapped in :where(), which counts for
       nothing and leaves three classes — more than this element plus its own
       class, until the rule is written out this long. The indent is meant for
       a list of actions on a page-wide row; on one Delete under a field it is
       a step with nothing to line up against. */
    && .ant-list .ant-list-item .ant-list-item-action {
      margin-inline-start: 0;
      padding-inline: 0;
      text-align: left;
    }

    && .ant-list .ant-list-item .ant-list-item-action > li {
      padding-inline: 0;
    }

    /* Whatever acts on an array, at the start of it. What adds an entry is
       handed to a centred flex row and what removes one to a list action, so
       the two controls doing the same kind of job to the same array sat at
       opposite ends of it. */
    .ant-list-footer,
    .ant-list-header {
      padding-inline: 0;
      text-align: left;
    }

    .ant-flex-justify-center,
    .ant-form-item-control-input-content > .ant-row {
      justify-content: flex-start;
    }

    /* At the rail's own control height, like every button beside it. */
    .ant-btn {
      height: ${theme.controlHeightSM}px;
      font-size: ${theme.fontSizeSM}px;
    }

    /* One rhythm down the column: the renderers space their own items and
       their dividers, and the two scales did not agree. */
    .ant-form-item {
      margin-bottom: ${theme.sizeUnit * 2}px;
    }

    .ant-divider-horizontal {
      margin: ${theme.sizeUnit * 3}px 0;
    }
  `}
`;

/**
 * A widget's properties as fields, generated from the values it holds.
 *
 * The other half of this panel edits the same properties as JSON, and the two
 * divide cleanly: JSON is where the *shape* is decided — a key added, a key
 * dropped — and this is where the values in that shape are filled in. That is
 * not a limitation to work around but what a generated form is: with no schema
 * shipped alongside a widget's registration (see `inferPropsSchema`), a field
 * can only exist where a value already does.
 *
 * Edits are written as they are made rather than held until focus leaves.
 * JsonForms already debounces what it reports by 10ms, and that debounce is
 * exactly what a commit on blur races: clicking away fires the blur first and
 * commits the draft as it stood a moment before the last keystroke, which
 * silently drops it. Writing from `onChange` has one ordering and no draft to
 * fall behind.
 */
export default function PropsForm({
  nodeId,
  props,
}: {
  nodeId: string;
  props: Record<string, unknown> | undefined;
}): ReactElement {
  const theme = useTheme();
  // Compared by value rather than by identity: `props` is a fresh object on
  // every render of the panel, so anything derived from it has to be keyed on
  // what it says rather than on which object it is, or the form is rebuilt
  // under the cursor on every unrelated tick of the store.
  const accepted = JSON.stringify(props ?? {});
  const data = useMemo(
    () => JSON.parse(accepted) as Record<string, unknown>,
    [accepted],
  );
  const schema = useMemo(() => inferPropsSchema(data), [data]);
  const untyped = useMemo(() => untypedKeys(data), [data]);
  const empty = Object.keys(schema.properties ?? {}).length === 0;

  const note = (text: string) => (
    <p
      style={{
        margin: 0,
        color: theme.colorTextTertiary,
        fontSize: theme.fontSizeSM,
      }}
    >
      {text}
    </p>
  );

  return (
    <FormShell
      data-test="inspector-props-form"
      // Labels above their fields, as everywhere else in this rail — beside
      // them halves the width left for the control, in the panel that most
      // needs the room.
      //
      // Said in classes rather than by wrapping this in an antd `Form`,
      // because that is what the renderers read: `useParentFormLayout` takes
      // the layout off the nearest `.ant-form` ancestor's class, by its own
      // account, precisely so it does not depend on antd's form context. A
      // real `Form` here would set the layout and take the edits with it —
      // see `PropsEditor`.
      className="ant-form ant-form-vertical"
    >
      {empty
        ? note(
            t(
              'This widget has no properties yet. Add them on the JSON tab, and they become fields here.',
            ),
          )
        : /* No `uischema`: JsonForms lays out whatever the schema describes,
             which is the point of generating the schema in the first place. */
          null}
      {!empty && (
        <JsonForms
          schema={schema}
          data={data}
          renderers={renderers}
          cells={cellRegistryEntries}
          // Nothing here is required and nothing is constrained, because the
          // schema was read off values a widget already renders from — so a
          // validation message could only ever be about a type this form
          // itself assigned.
          validationMode="NoValidation"
          onChange={({ data: next }) => {
            // Guarded because this fires on mount with what was passed in,
            // and again with the value that has just been written — neither
            // is an edit, and both would otherwise tick the store.
            if (JSON.stringify(next) !== accepted) {
              provider.updateProps(nodeId, next as Record<string, unknown>);
            }
          }}
        />
      )}
      {untyped.length > 0 &&
        note(
          t(
            'Only editable as JSON, having no value to take a type from: %s',
            untyped.join(', '),
          ),
        )}
    </FormShell>
  );
}
