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
import { ReactNode, useCallback } from 'react';
import { Divider, Form, Typography } from '@superset-ui/core/components';
import { css } from '@superset-ui/core';
import { recurseReactClone } from './utils';
import Field from './Field';

interface FieldsetProps {
  children: ReactNode;
  onChange: (updatedItem: Record<string, any>) => void;
  item: Record<string, any>;
  title?: ReactNode;
  compact?: boolean;
}

type fieldKeyType = string | number;

export default function Fieldset({
  children,
  onChange,
  item,
  title = null,
  compact = false,
}: FieldsetProps) {
  const handleChange = useCallback(
    (fieldKey: fieldKeyType, val: any) => {
      onChange({
        ...item,
        [fieldKey]: val,
      });
    },
    [onChange, item],
  );

  const propExtender = (field: { props: { fieldKey: fieldKeyType } }) => ({
    onChange: handleChange,
    value: item[field.props.fieldKey],
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

      {recurseReactClone(children, Field, propExtender)}
    </Form>
  );
}
