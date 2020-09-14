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

interface CheckboxProps {
  checked: boolean;
  onChange: (val?: boolean) => {};
  style: object;
}

export default function Checkbox({ checked, onChange, style }: CheckboxProps) {
  return (
    <span style={style}>
      <i
        role="button"
        aria-label="Checkbox"
        tabIndex={0}
        className={`fa fa-check ${
          checked ? 'text-primary' : 'text-transparent'
        }`}
        onClick={() => {
          onChange(!checked);
        }}
        style={{
          border: '1px solid #aaa',
          borderRadius: '2px',
          cursor: 'pointer',
        }}
      />
    </span>
  );
}
