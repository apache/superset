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
import { ReactElement } from 'react';
// @ts-ignore
import { DndFilterSelect as DndFilterSelectControl } from '../../../../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import { Datasource } from '../../types';

export interface DndFilterSelectProps {
  value?: any[];
  onChange: (value: any[]) => void;
  datasource?: Datasource;
  columns?: any[];
  formData?: any;
  savedMetrics?: any[];
  selectedMetrics?: any[];
  name?: string;
  actions?: any;
  type?: string;
  [key: string]: any;
}

/**
 * Wrapper around the existing DndFilterSelect that simplifies its API
 */
export const DndFilterSelect: React.FC<DndFilterSelectProps> = ({
  value = [],
  onChange,
  datasource,
  columns = [],
  formData = {},
  savedMetrics = [],
  selectedMetrics = [],
  name = 'adhoc_filters',
  actions,
  type = 'DndFilterSelect',
  ...restProps
}): ReactElement => {
  // Handle the case where onChange needs to be wrapped for actions.setControlValue
  const handleChange = (val: any) => {
    if (actions?.setControlValue) {
      actions.setControlValue(name, val);
    } else if (onChange) {
      onChange(val);
    }
  };

  // For compatibility with the original component
  const componentProps = {
    value,
    onChange: handleChange,
    datasource,
    columns,
    formData,
    name,
    savedMetrics,
    selectedMetrics,
    type,
    actions,
    ...restProps,
  };

  return (
    <div className="filter-select-wrapper">
      <DndFilterSelectControl {...componentProps} />
    </div>
  );
};
