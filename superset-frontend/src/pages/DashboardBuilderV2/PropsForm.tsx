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
import { useTheme } from '@apache-superset/core/theme';
import { JsonForms } from '@jsonforms/react';
import { cellRegistryEntries } from '@great-expectations/jsonforms-antd-renderers';
import { renderers } from 'src/features/semanticLayers/jsonFormsHelpers';
import { provider } from 'src/core/dashboard/store';
import inferPropsSchema, { untypedKeys } from './inferPropsSchema';

/**
 * A block's properties as fields, generated from the values it holds.
 *
 * The other half of this panel edits the same properties as JSON, and the two
 * divide cleanly: JSON is where the *shape* is decided — a key added, a key
 * dropped — and this is where the values in that shape are filled in. That is
 * not a limitation to work around but what a generated form is: with no schema
 * shipped alongside a block's registration (see `inferPropsSchema`), a field
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
    <div
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
              'This block has no properties yet. Add them on the JSON tab, and they become fields here.',
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
          // schema was read off values a block already renders from — so a
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
    </div>
  );
}
