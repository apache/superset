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
import { useState, ChangeEvent } from 'react';

interface NumberInputProps {
  timeUnit: string;
  min: number;
  name: string;
  value: string | number;
  placeholder: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export default function NumberInput({
  timeUnit,
  min,
  name,
  value,
  placeholder,
  onChange,
}: NumberInputProps) {
  const [isFocused, setIsFocused] = useState<boolean>(false);

  return (
    <input
      type="text"
      min={min}
      name={name}
      value={value ? `${value}${!isFocused ? ` ${timeUnit}` : ''}` : ''}
      placeholder={placeholder}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onChange={onChange}
    />
  );
}
