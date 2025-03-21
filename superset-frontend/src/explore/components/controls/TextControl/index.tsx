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
import { ChangeEvent, useState, useEffect, useCallback, useRef } from 'react';
import { legacyValidateNumber, legacyValidateInteger } from '@superset-ui/core';
import { debounce } from 'lodash';
import { FAST_DEBOUNCE } from 'src/constants';
import ControlHeader from 'src/explore/components/ControlHeader';
import { Input } from 'src/components/Input';

type InputValueType = string | number;

export interface TextControlProps<T extends InputValueType = InputValueType> {
  label?: string;
  disabled?: boolean;
  isFloat?: boolean;
  isInt?: boolean;
  onChange?: (value: T, errors: any) => void;
  onFocus?: () => {};
  placeholder?: string;
  value?: T | null;
  controlId?: string;
  renderTrigger?: boolean;
}

const safeStringify = (value?: InputValueType | null) =>
  value == null ? '' : String(value);

export default function TextControl<T extends InputValueType = InputValueType>(
  props: TextControlProps<T>,
) {
  const {
    value: propsValue,
    onChange,
    isFloat,
    isInt,
    onFocus,
    placeholder,
    disabled,
    label,
  } = props;

  const initialValueRef = useRef(propsValue);
  const [value, setValue] = useState(safeStringify(initialValueRef.current));

  // Handle value changes from props
  useEffect(() => {
    if (initialValueRef.current !== propsValue) {
      initialValueRef.current = propsValue;
      setValue(safeStringify(propsValue));
    }
  }, [propsValue]);

  const handleChange = useCallback(
    (inputValue: string) => {
      let parsedValue: InputValueType = inputValue;
      // Validation & casting
      const errors = [];
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
    [onChange, isFloat, isInt],
  );

  const debouncedOnChange = useCallback(
    debounce((inputValue: string) => {
      handleChange(inputValue);
    }, FAST_DEBOUNCE),
    [handleChange],
  );

  const onChangeWrapper = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const inputValue = event.target.value;
      setValue(inputValue);
      debouncedOnChange(inputValue);
    },
    [debouncedOnChange],
  );

  return (
    <div>
      <ControlHeader {...props} />
      <Input
        type="text"
        data-test="inline-name"
        placeholder={placeholder}
        onChange={onChangeWrapper}
        onFocus={onFocus}
        value={value}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}
