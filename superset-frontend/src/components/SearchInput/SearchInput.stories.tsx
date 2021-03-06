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
import React, { useState } from 'react';
import SearchInput, { SearchInputProps } from '.';

export default {
  title: 'SearchInput',
  component: SearchInput,
};

export const InteractiveSearchInput = ({
  value,
  ...rest
}: SearchInputProps) => {
  const [currentValue, setCurrentValue] = useState(value);
  return (
    <div style={{ width: 230 }}>
      <SearchInput
        {...rest}
        value={currentValue}
        onChange={e => setCurrentValue(e.target.value)}
        onClear={() => setCurrentValue('')}
      />
    </div>
  );
};

InteractiveSearchInput.args = {
  value: 'Test',
  placeholder: 'Enter some text',
  name: 'search-input',
};

InteractiveSearchInput.argTypes = {
  onSubmit: { action: 'onSubmit' },
  onClear: { action: 'onClear' },
  onChange: { action: 'onChange' },
};

InteractiveSearchInput.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
