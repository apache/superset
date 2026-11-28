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
import { useState, FunctionComponentElement, ChangeEvent } from 'react';
import { JsonValue } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { ControlFormItemComponents } from './controls';
import ControlHeader, { ControlHeaderProps } from '../../../ControlHeader';
import { ControlFormItemDefaultSpec } from '../types';

export * from './controls';

export type ControlFormItemProps = ControlFormItemDefaultSpec & {
  name: string;
  onChange?: (fieldValue: JsonValue) => void;
  onReset?: () => void;
};

export type ControlFormItemNode =
  FunctionComponentElement<ControlFormItemProps>;

/**
 * Accept `false` or `0`, but not empty string.
 */
function isEmptyValue(value?: JsonValue) {
  return value == null || value === '';
}

export function ControlFormItem({
  name,
  label,
  description,
  width,
  validators,
  onChange,
  onReset,
  value: initialValue,
  defaultValue,
  controlType,
  resettable = false,
  ...props
}: ControlFormItemProps) {
  const { sizeUnit, fontSizeXS } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [value, setValue] = useState(
    initialValue === undefined ? defaultValue : initialValue,
  );
  const [prevInitialValue, setPrevInitialValue] = useState(initialValue);
  if (initialValue !== prevInitialValue) {
    // the parent value changed outside this item (e.g. the reset action
    // removed the key) — follow it instead of keeping the stale local state
    setPrevInitialValue(initialValue);
    setValue(initialValue === undefined ? defaultValue : initialValue);
  }
  const [validationErrors, setValidationErrors] =
    useState<ControlHeaderProps['validationErrors']>();

  const handleChange = (e: ChangeEvent<HTMLInputElement> | JsonValue) => {
    const fieldValue =
      e && typeof e === 'object' && 'target' in e
        ? e.target.type === 'checkbox' || e.target.type === 'radio'
          ? e.target.checked
          : e.target.value
        : e;
    const errors =
      (validators
        ?.map(validator =>
          isEmptyValue(fieldValue) ? false : validator(fieldValue),
        )
        .filter(x => !!x) as string[]) || [];
    setValidationErrors(errors);
    setValue(fieldValue);
    if (errors.length === 0 && onChange) {
      onChange(fieldValue as JsonValue);
    }
  };

  const Control = ControlFormItemComponents[controlType];
  // A resettable field shows the reset action only when this column carries
  // an explicit value in its config; without one it already follows the
  // chart-level option. The internal checkbox state falls back to the spec
  // default after a reset, so the marker must come from the config value.
  const hasOverride =
    resettable && controlType === 'Checkbox' && initialValue !== undefined;

  return (
    <div
      css={{
        margin: 2 * sizeUnit,
        width,
        maxWidth: '100%',
        flex: 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {controlType === 'Checkbox' ? (
        <>
          <ControlFormItemComponents.Checkbox
            value={value as boolean}
            onChange={handleChange}
            name={name}
            label={label}
            description={description}
            validationErrors={validationErrors}
            {...props}
          />
          {hasOverride && onReset && (
            <div
              css={{
                marginTop: sizeUnit,
                paddingLeft: sizeUnit * 6,
              }}
            >
              <Button
                type="link"
                size="small"
                css={{ padding: 0, height: 'auto', fontSize: fontSizeXS }}
                onClick={onReset}
              >
                <Icons.RollbackOutlined iconSize="s" />{' '}
                {t('Use the chart-level setting')}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          {label && (
            <ControlHeader
              name={name}
              label={label}
              description={description}
              validationErrors={validationErrors}
              hovered={hovered}
            />
          )}
          {/* @ts-expect-error - dynamic Control component has varying prop types */}
          <Control {...props} value={value} onChange={handleChange} />
        </>
      )}
    </div>
  );
}

export default ControlFormItem;
