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

import { css, SupersetTheme } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { FormItem, FormLabel } from 'src/components/Form';
import { Icons } from 'src/components/Icons';

const formItemInlineCss = css`
  .ant-form-item-control-input-content {
    display: flex;
    flex-direction: row;
  }
`;
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

  const hookedControl = cloneElement(control, {
    value,
    onChange: onControlChange,
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
        label={
          <FormLabel className="m-r-5">
            {label || fieldKey}
            {compact && description && (
              <Tooltip id="field-descr" placement="right" title={description}>
                <Icons.InfoCircleFilled iconSize="s" className="m-l-5" />
              </Tooltip>
            )}
          </FormLabel>
        }
        css={inline && formItemInlineCss}
      >
        {hookedControl}
        {!compact && description && (
          <div
            css={(theme: SupersetTheme) => ({
              color: theme.colors.grayscale.base,
              [inline ? 'marginLeft' : 'marginTop']: theme.gridUnit,
            })}
          >
            {description}
          </div>
        )}
      </FormItem>
      {errorMessage && (
        <div
          css={(theme: SupersetTheme) => ({
            color: theme.colors.error.base,
            marginTop: -16,
            fontSize: theme.typography.sizes.s,
          })}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
