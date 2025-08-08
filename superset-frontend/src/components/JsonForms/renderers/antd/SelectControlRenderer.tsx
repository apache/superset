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

import { FC } from 'react';
import {
  ControlProps,
  isEnumControl,
  RankedTester,
  rankWith,
} from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { Select } from '@superset-ui/core/components';
import { ControlHeader } from '@superset-ui/chart-controls';

export const SelectControlRenderer: FC<ControlProps> = ({
  data,
  handleChange,
  path,
  label,
  schema,
  errors,
  description,
  visible,
  required,
  uischema,
}) => {
  if (!visible) {
    return null;
  }

  // Get options from schema enum or uischema options
  const options =
    schema.enum?.map(value => ({
      value,
      label:
        (schema as any).enumNames?.[schema.enum!.indexOf(value)] ||
        String(value),
    })) ||
    (uischema as any)?.options?.choices ||
    [];

  return (
    <div style={{ marginBottom: '16px' }}>
      <ControlHeader
        name={path}
        label={label}
        description={description || schema.description}
        validationErrors={typeof errors === 'string' ? [errors] : errors}
        required={required}
      />
      <Select
        value={data}
        onChange={(value: any) => handleChange(path, value)}
        options={options}
        allowClear={!required}
        placeholder={(schema as any).examples?.[0] || 'Select...'}
        css={{ width: '100%' }}
      />
    </div>
  );
};

export const selectControlTester: RankedTester = rankWith(5, isEnumControl);

export default withJsonFormsControlProps(SelectControlRenderer);
