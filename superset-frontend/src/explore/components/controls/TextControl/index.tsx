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
import { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react';
import { legacyValidateNumber, legacyValidateInteger } from '@superset-ui/core';
import { debounce } from 'lodash-es';
import ControlHeader from 'src/explore/components/ControlHeader';
import { Constants, Input } from '@superset-ui/core/components';

type InputValueType = string | number;

export interface TextControlProps<T extends InputValueType = InputValueType> {
  name?: string;
  label?: string;
  ariaLabel?: string;
  description?: string;
  disabled?: boolean;
  isFloat?: boolean;
  isInt?: boolean;
  onChange?: (value: T, errors: string[]) => void;
  onFocus?: () => void;
  placeholder?: string;
  value?: T | null;
  controlId?: string;
  renderTrigger?: boolean;
  validationErrors?: string[];
  hovered?: boolean;
  showHeader?: boolean;
}

const safeStringify = (value?: InputValueType | null) =>
  value == null ? '' : String(value);

function TextControl<T extends InputValueType = InputValueType>({
  name,
  label,
  ariaLabel,
  description,
  disabled,
  isFloat,
  isInt,
  onChange,
  onFocus,
  placeholder,
  value,
  renderTrigger,
  validationErrors,
  hovered,
}: TextControlProps<T>) {
  const [localValue, setLocalValue] = useState<string>(safeStringify(value));
  const [prevValue, setPrevValue] = useState<T | null | undefined>(value);

  const handleChange = useCallback(
    (inputValue: string) => {
      let parsedValue: InputValueType = inputValue;
      const errors: string[] = [];

      if (inputValue !== '' && isFloat) {
        const error = legacyValidateNumber(inputValue);
        if (error) {
          errors.push(error);
        } else {
          parsedValue = inputValue.match(/.*([.0])$/g)
            ? inputValue
            : parseFloat(inputValue);
        }
      }

      if (inputValue !== '' && isInt) {
        const error = legacyValidateInteger(inputValue);
        if (error) {
          errors.push(error);
        } else {
          parsedValue = parseInt(inputValue, 10);
        }
      }

      onChange?.(parsedValue as T, errors);
    },
    [isFloat, isInt, onChange],
  );

  const debouncedOnChangeRef = useRef(
    debounce((inputValue: string, changeFn: (val: string) => void) => {
      changeFn(inputValue);
    }, Constants.FAST_DEBOUNCE),
  );

  useEffect(
    () => () => {
      debouncedOnChangeRef.current.cancel();
    },
    [],
  );

  const onChangeWrapper = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value: newValue } = event.target;
      setLocalValue(newValue);
      debouncedOnChangeRef.current(newValue, handleChange);
    },
    [handleChange],
  );

  // Sync local value when prop value changes externally. Adjusting state during
  // render is React's documented pattern for this; deriving a display value
  // without writing it back left `localValue` holding the superseded text, so
  // the very next render -- one that only changes an unrelated prop, and so
  // does not re-enter this branch -- put the stale value back in the input.
  if (safeStringify(prevValue) !== safeStringify(value)) {
    setPrevValue(value);
    setLocalValue(safeStringify(value));
  }
  const displayValue = localValue;

  return (
    <div>
      <ControlHeader
        name={name}
        label={label}
        description={description}
        renderTrigger={renderTrigger}
        validationErrors={validationErrors}
        hovered={hovered}
      />
      <Input
        type="text"
        data-test="inline-name"
        placeholder={placeholder}
        onChange={onChangeWrapper}
        onFocus={onFocus}
        value={displayValue}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
      />
    </div>
  );
}

export default TextControl;
