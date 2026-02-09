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
  ChangeEvent,
  FC,
  FocusEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { debounce } from 'lodash';
import { Input } from '@superset-ui/core/components';
import type { InputProps } from '@superset-ui/core/components';

const DEFAULT_DEBOUNCE_MS = 300;

export interface DeferredInputProps extends Omit<InputProps, 'onChange'> {
  /** External value. Syncs internal state when changed from outside. */
  value?: string;
  /** Called on blur and after debounce delay — NOT on every keystroke. */
  onChange?: (value: string) => void;
  /** Debounce delay in ms. Default: 300. */
  debounceMs?: number;
}

/**
 * Input with deferred propagation. Maintains local state for instant
 * keystroke feedback; propagates to parent only on blur / debounce timeout.
 * Accepts external `value` for locale switching and form resets.
 */
const DeferredInput: FC<DeferredInputProps> = ({
  value,
  onChange,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onBlur,
  ...rest
}) => {
  const [localValue, setLocalValue] = useState(value ?? '');
  const lastPropagatedRef = useRef(value ?? '');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (value !== undefined && value !== lastPropagatedRef.current) {
      setLocalValue(value);
      lastPropagatedRef.current = value;
    }
  }, [value]);

  const debouncedPropagate = useMemo(
    () =>
      debounce((val: string) => {
        lastPropagatedRef.current = val;
        onChangeRef.current?.(val);
      }, debounceMs),
    [debounceMs],
  );

  // Flush pending propagation on unmount
  useEffect(() => () => debouncedPropagate.flush(), [debouncedPropagate]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
      debouncedPropagate(e.target.value);
    },
    [debouncedPropagate],
  );

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      debouncedPropagate.flush();
      onBlur?.(e);
    },
    [debouncedPropagate, onBlur],
  );

  return (
    <Input
      {...rest}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

export default DeferredInput;
