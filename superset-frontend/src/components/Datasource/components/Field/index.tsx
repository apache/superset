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
import { useCallback, ReactNode, ReactElement, cloneElement } from 'react';

import { css, SupersetTheme, useTheme } from '@superset-ui/core';
import {
  Icons,
  Tooltip,
  FormItem,
  FormLabel,
} from '@superset-ui/core/components';

interface FieldProps<V> {
  fieldKey: string;
  value?: V;
  label: string;
  description?: ReactNode;
  control: ReactElement;
  additionalControl?: ReactElement;
  onChange: (fieldKey: string, newValue: V) => void;
  compact: boolean;
  inline: boolean;
  errorMessage?: string | ReactElement;
}

export default function Field<V>({
  fieldKey,
  value,
  label,
  description = null,
  control,
  additionalControl,
  onChange = () => {},
  compact = false,
  inline,
  errorMessage,
}: FieldProps<V>) {
  const onControlChange = useCallback(
    newValue => {
      onChange(fieldKey, newValue);
    },
    [onChange, fieldKey],
  );

  const theme = useTheme();
  const extra = !compact && description ? description : undefined;
  const infoTooltip =
    compact && description ? (
      <Tooltip
        css={css`
          color: ${theme.colorTextTertiary};
        `}
        id="field-descr"
        placement="right"
        title={description}
      >
        <Icons.InfoCircleOutlined
          iconSize="s"
          css={css`
            margin-left: ${theme.marginXXS}px;
          `}
          iconColor={theme.colorTextTertiary}
        />
      </Tooltip>
    ) : undefined;

  const hookedControl = cloneElement(control, {
    value,
    onChange: onControlChange,
    label: (
      <FormLabel>
        {label || fieldKey}
        {infoTooltip}
      </FormLabel>
    ),
  });

  return (
    <div
      css={
        additionalControl &&
        css`
          position: relative;
        `
      }
    >
      {additionalControl}
      <FormItem
        extra={extra}
        css={
          !inline &&
          css`
            .ControlHeader {
              margin-bottom: ${theme.marginXXS}px;
            }
          `
        }
      >
        {hookedControl}
      </FormItem>
      {errorMessage && (
        <div
          css={(theme: SupersetTheme) => ({
            color: theme.colorText,
            [inline ? 'marginLeft' : 'marginTop']: theme.marginXXS,
          })}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
