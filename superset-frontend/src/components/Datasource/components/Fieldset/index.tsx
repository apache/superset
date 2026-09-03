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
import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { Divider, Form, Typography } from '@superset-ui/core/components';
import { css } from '@apache-superset/core/theme';
import { recurseReactClone } from '../../utils';
import Field from '../Field';

export interface FieldsetProps {
  children: ReactNode;
  onChange?: (updatedItem: Record<string, any>) => void;
  onFieldChange?: (fieldKey: fieldKeyType, value: unknown) => void;
  item?: Record<string, any>;
  title?: ReactNode;
  compact?: boolean;
  renderWarning?: (item: Record<string, any>) => ReactNode;
}

type fieldKeyType = string | number;

export default function Fieldset({
  children,
  onChange,
  onFieldChange,
  item = {},
  title = null,
  compact = false,
  renderWarning,
}: FieldsetProps) {
  // Controls report their edits asynchronously - TextControl debounces by
  // FAST_DEBOUNCE - so the callback that eventually fires was built during an
  // earlier render. Spreading that render's `item` rebuilds the whole record
  // from a snapshot taken before a sibling field committed, dropping the value
  // the user typed first. Reading off a ref merges into the latest commit.
  const itemRef = useRef(item);
  useEffect(() => {
    itemRef.current = item;
  }, [item]);

  const handleChange = useCallback(
    (fieldKey: fieldKeyType, val: any) => {
      const updatedItem = {
        ...itemRef.current,
        [fieldKey]: val,
      };
      // Multiple debounced controls can commit in the same React batch, before
      // the effect above has synchronized the item passed back by the parent.
      // Advance the ref synchronously so the later commit includes its sibling.
      itemRef.current = updatedItem;
      if (onFieldChange) {
        onFieldChange(fieldKey, val);
      } else {
        onChange?.(updatedItem);
      }
    },
    [onChange, onFieldChange],
  );

  const propExtender = (field: { props: { fieldKey: fieldKeyType } }) => ({
    onChange: handleChange,
    value: item?.[field.props.fieldKey],
    compact,
  });

  return (
    <Form className="CRUD" layout="vertical">
      {title && (
        <Typography.Title
          level={5}
          css={css`
            margin-top: 0.5em;
          `}
        >
          {title} <Divider />
        </Typography.Title>
      )}

      {renderWarning?.(item)}
      {recurseReactClone(children, Field, propExtender)}
    </Form>
  );
}
