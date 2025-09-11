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
import {
  Children,
  cloneElement,
  FunctionComponentElement,
  useMemo,
} from 'react';
import {
  FAST_DEBOUNCE,
  JsonObject,
  JsonValue,
  useTheme,
} from '@superset-ui/core';
import { debounce } from 'lodash';
import { ControlFormItemNode } from './ControlFormItem';

export * from './ControlFormItem';

export type ControlFormRowProps = {
  children: ControlFormItemNode | ControlFormItemNode[];
};

export function ControlFormRow({ children }: ControlFormRowProps) {
  const { gridUnit } = useTheme();
  return (
    <div
      css={{
        display: 'flex',
        flexWrap: 'nowrap',
        marginBottom: gridUnit,
        maxWidth: '100%',
      }}
    >
      {children}
    </div>
  );
}

type ControlFormRowNode = FunctionComponentElement<ControlFormRowProps>;

export type ControlFormProps = {
  /**
   * Form field values dict.
   */
  value?: JsonObject;
  onChange: (value: JsonObject) => void;
  children: ControlFormRowNode | ControlFormRowNode[];
};

/**
 * Light weight form for control panel.
 */
export default function ControlForm({
  onChange,
  value,
  children,
}: ControlFormProps) {
  const theme = useTheme();
  const debouncedOnChange = useMemo(
    () =>
      ({
        0: onChange,
        [FAST_DEBOUNCE]: debounce(onChange, FAST_DEBOUNCE),
      }) as Record<number, typeof onChange>,
    [onChange],
  );

  const updatedChildren = Children.map(children, row => {
    if ('children' in row.props) {
      const defaultWidth = Array.isArray(row.props.children)
        ? `${100 / row.props.children.length}%`
        : undefined;
      return cloneElement(row, {
        children: Children.map(row.props.children, item => {
          const {
            name,
            width,
            debounceDelay = FAST_DEBOUNCE,
            onChange: onItemValueChange,
          } = item.props;
          return cloneElement(item, {
            width: width || defaultWidth,
            value: value?.[name],
            // remove `debounceDelay` from rendered control item props
            // so React DevTools don't throw a `invalid prop` warning.
            debounceDelay: undefined,
            onChange(fieldValue: JsonValue) {
              // call `onChange` on each FormItem
              if (onItemValueChange) {
                onItemValueChange(fieldValue);
              }
              // propagate to the form
              if (!(debounceDelay in debouncedOnChange)) {
                debouncedOnChange[debounceDelay] = debounce(
                  onChange,
                  debounceDelay,
                );
              }
              debouncedOnChange[debounceDelay]({
                ...value,
                [name]: fieldValue,
              });
            },
          });
        }),
      });
    }
    return row;
  });
  return (
    <div
      css={{
        label: {
          textTransform: 'uppercase',
          color: theme.colors.text.label,
          fontSize: theme.typography.sizes.s,
        },
      }}
    >
      {updatedChildren}
    </div>
  );
}
