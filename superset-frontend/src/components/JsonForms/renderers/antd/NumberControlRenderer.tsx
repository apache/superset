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
  isNumberControl,
  isIntegerControl,
  RankedTester,
  rankWith,
  or,
} from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { Input } from '@superset-ui/core/components';
import { ControlHeader } from '@superset-ui/chart-controls';

export const NumberControlRenderer: FC<ControlProps> = ({
  data,
  handleChange,
  path,
  label,
  schema,
  errors,
  description,
  visible,
  required,
}) => {
  if (!visible) {
    return null;
  }

  const handleNumberChange = (e: any) => {
    const { value } = e.target;
    if (value === '') {
      handleChange(path, undefined);
    } else {
      const num =
        schema.type === 'integer' ? parseInt(value, 10) : parseFloat(value);
      if (!isNaN(num)) {
        handleChange(path, num);
      }
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <ControlHeader
        name={path}
        label={label}
        description={description || schema.description}
        validationErrors={typeof errors === 'string' ? [errors] : errors}
        required={required}
      />
      <Input
        type="number"
        value={data ?? ''}
        onChange={handleNumberChange}
        placeholder={(schema as any).examples?.[0] || ''}
        min={schema.minimum}
        max={schema.maximum}
        step={schema.type === 'integer' ? 1 : 'any'}
      />
    </div>
  );
};

export const numberControlTester: RankedTester = rankWith(
  4,
  or(isNumberControl, isIntegerControl),
);

export default withJsonFormsControlProps(NumberControlRenderer);
