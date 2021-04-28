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
import { t } from '@superset-ui/core';

import PopoverDropdown, {
  OnChangeHandler,
} from 'src/components/PopoverDropdown';

interface MarkdownModeDropdownProps {
  id: string;
  value: string;
  onChange: OnChangeHandler;
}

const dropdownOptions = [
  {
    value: 'edit',
    label: t('Edit'),
  },
  {
    value: 'preview',
    label: t('Preview'),
  },
];

export default class MarkdownModeDropdown extends React.PureComponent<MarkdownModeDropdownProps> {
  render() {
    const { id, value, onChange } = this.props;

    return (
      <PopoverDropdown
        id={id}
        options={dropdownOptions}
        value={value}
        onChange={onChange}
      />
    );
  }
}
