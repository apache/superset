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
  useState,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  ChangeEvent,
} from 'react';
import { legacyValidateNumber, legacyValidateInteger } from '@superset-ui/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import { debounce } from 'lodash-es';
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
  // null until the user types; distinguishes a real edit from the prop-sync
  // branch below, which also writes `localValue` but must never trigger
  // `onChange`.
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const deferredPendingValue = useDeferredValue(pendingValue);

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

  // Read through a ref so a parent re-render that hands down a new `onChange`
  // identity doesn't re-fire this effect on its own -- only an actual
  // keystroke (a change to `deferredPendingValue`) should.
  const handleChangeRef = useRef(handleChange);
  handleChangeRef.current = handleChange;

  // Outbound onChange keeps a trailing coalescing window so consumers
  // (renderTrigger re-renders, filtered collection tables) only see the
  // settled value rather than every intermediate keystroke the deferred value
  // happens to commit.
  // Newest raw keystroke, not yet emitted. Blur emits this rather than the
  // (possibly lagging) deferred value so the last character is never lost.
  const latestTypedRef = useRef<string | null>(null);
  const debouncedEmitRef = useRef(
    debounce((inputValue: string) => {
      // A newer keystroke (or an external reset) has superseded this value;
      // emitting it would echo back through the prop-sync branch and wipe the
      // newer text.
      if (latestTypedRef.current !== inputValue) {
        return;
      }
      latestTypedRef.current = null;
      handleChangeRef.current(inputValue);
    }, Constants.FAST_DEBOUNCE),
  );

  // Fires once the deferred value catches up with the latest keystroke.
  // The deferred value keeps the input responsive during a burst of typing;
  // the debounce then coalesces what reaches `onChange`.
  useEffect(() => {
    if (deferredPendingValue !== null) {
      debouncedEmitRef.current(deferredPendingValue);
    } else {
      debouncedEmitRef.current.cancel();
    }
  }, [deferredPendingValue]);

  useEffect(
    () => () => {
      debouncedEmitRef.current.cancel();
    },
    [],
  );

  const onBlurFlush = useCallback(() => {
    // An external reset clears latestTypedRef; drop a stale queued emit
    // rather than flushing it over the reset value.
    if (latestTypedRef.current === null) {
      debouncedEmitRef.current.cancel();
      return;
    }
    debouncedEmitRef.current(latestTypedRef.current);
    debouncedEmitRef.current.flush();
  }, []);

  const onChangeWrapper = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value: newValue } = event.target;
      latestTypedRef.current = newValue;
      setLocalValue(newValue);
      setPendingValue(newValue);
    },
    [],
  );

  // Sync local value when prop value changes externally. Adjusting state during
  // render is React's documented pattern for this; deriving a display value
  // without writing it back left `localValue` holding the superseded text, so
  // the very next render -- one that only changes an unrelated prop, and so
  // does not re-enter this branch -- put the stale value back in the input.
  if (safeStringify(prevValue) !== safeStringify(value)) {
    setPrevValue(value);
    setLocalValue(safeStringify(value));
    // An external reset supersedes any in-flight edit; clearing it lets an
    // identical edit afterwards register as a fresh change.
    setPendingValue(null);
    latestTypedRef.current = null;
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
        onBlur={onBlurFlush}
        value={displayValue}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
      />
    </div>
  );
}

export default TextControl;
