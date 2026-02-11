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
import { ChangeEvent, forwardRef, useCallback } from 'react';
import { InputRef } from 'antd';
import { Input } from '@superset-ui/core/components';
import type { InputProps } from '@superset-ui/core/components';

export interface TranslationInputProps extends Omit<InputProps, 'onChange'> {
  /** Current value for the active locale. */
  value?: string;
  /** Called immediately on every keystroke with the new value. */
  onChange?: (value: string) => void;
}

/**
 * Simple input for translation values.
 * Calls onChange immediately with the string value (not event).
 */
const TranslationInput = forwardRef<InputRef, TranslationInputProps>(
  ({ value, onChange, ...rest }, ref) => {
    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        onChange?.(e.target.value);
      },
      [onChange],
    );

    return (
      <Input
        ref={ref}
        {...rest}
        value={value ?? ''}
        onChange={handleChange}
      />
    );
  },
);

TranslationInput.displayName = 'TranslationInput';

export default TranslationInput;
