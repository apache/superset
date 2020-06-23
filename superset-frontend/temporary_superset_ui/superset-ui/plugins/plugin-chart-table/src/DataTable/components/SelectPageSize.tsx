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
import React from 'react';

export type SizeOption = number | [number, string];

export interface SelectPageSizeProps {
  sizeOptions: SizeOption[];
  currentSize?: number;
  total?: number;
  onChange: (pageSize: number) => void;
}

function getOptionValue(x: SizeOption) {
  return Array.isArray(x) ? x[0] : x;
}

export default React.memo(function SelectPageSize({
  total,
  sizeOptions,
  currentSize,
  onChange,
}: SelectPageSizeProps) {
  const sizeOptionValues = sizeOptions.map(getOptionValue);
  let options = [...sizeOptions];
  // insert current size to list
  if (
    currentSize !== undefined &&
    (currentSize !== total || !sizeOptionValues.includes(0)) &&
    !sizeOptionValues.includes(currentSize)
  ) {
    options = [...sizeOptions];
    options.splice(
      sizeOptionValues.findIndex(x => x > currentSize),
      0,
      currentSize,
    );
  }
  const current = currentSize === undefined ? sizeOptionValues[0] : currentSize;
  return (
    <span className="dt-select-page-size form-inline">
      Show{' '}
      <select
        className="form-control input-sm"
        value={current}
        onBlur={() => {}}
        onChange={e => {
          onChange(Number((e.target as HTMLSelectElement).value));
        }}
      >
        {options.map(option => {
          const [size, text] = Array.isArray(option) ? option : [option, option];
          return (
            <option key={size} value={size}>
              {text}
            </option>
          );
        })}
      </select>{' '}
      entries
    </span>
  );
});
