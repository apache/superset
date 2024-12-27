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
import { useState, useRef, useCallback } from 'react';
import { Divider } from 'src/components/Divider';
import { Input } from 'src/components/Input';
import { CronPicker, CronError, CronProps } from '.';

export default {
  title: 'CronPicker',
  component: CronPicker,
};

export const InteractiveCronPicker = (props: CronProps) => {
  // @ts-ignore
  const inputRef = useRef<Input>(null);
  const [value, setValue] = useState(props.value);
  const customSetValue = useCallback(
    (newValue: string) => {
      setValue(newValue);
      inputRef.current?.setValue(newValue);
    },
    [inputRef],
  );
  const [error, onError] = useState<CronError>();

  return (
    <div>
      <Input
        ref={inputRef}
        onBlur={event => {
          setValue(event.target.value);
        }}
        onChange={e => setValue(e.target.value || '')}
      />
      <Divider />
      <CronPicker
        {...props}
        value={value}
        setValue={customSetValue}
        onError={onError}
      />
      {error && <p style={{ marginTop: 20 }}>Error: {error.description}</p>}
    </div>
  );
};

InteractiveCronPicker.args = {
  clearButton: false,
  disabled: false,
  readOnly: false,
};

InteractiveCronPicker.argTypes = {
  value: {
    defaultValue: '30 5 * * *',
    table: {
      disable: true,
    },
  },
  theme: {
    table: {
      disable: true,
    },
  },
};
