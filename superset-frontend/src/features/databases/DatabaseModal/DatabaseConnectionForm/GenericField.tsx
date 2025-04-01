/**
 * import InfoTooltip from 'src/components/InfoTooltip'm
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

import { useEffect } from 'react';
import { styled } from '@superset-ui/core';
// eslint-disable-next-line no-restricted-imports
import { SelectValue } from 'antd/lib/select';
import InfoTooltip from 'src/components/InfoTooltip';
import Select from 'src/components/Select/Select';
import FormItem from 'src/components/Form/FormItem';
import FormLabel from 'src/components/Form/FormLabel';
import ValidatedInput from 'src/components/Form/LabeledErrorBoundInput';
import { DatabaseParameters, FieldPropTypes } from '../../types';

const StyledFormGroup = styled('div')`
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  .ant-form-item {
    margin-bottom: 0;
  }
`;

const StyledAlignment = styled.div`
  display: flex;
  align-items: center;
`;

const StyledFormLabel = styled(FormLabel)`
  margin-bottom: 0;
`;

export const GenericField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
  field,
  parameter,
}: FieldPropTypes) => {
  // set default values
  useEffect(() => {
    if (!db?.parameters?.[field as keyof DatabaseParameters] && parameter?.default !== undefined) {
      changeMethods.onParametersChange({
        target: { name: field, value: parameter.default },
      });
    }
  }, []);

  const handleOptionChange = (value: SelectValue) => {
    changeMethods.onParametersChange({
      target: { name: field, value },
    });
  };

  // enums are mapped to select inputs
  if (parameter?.enum) {
    return (
      <StyledFormGroup>
        <StyledAlignment>
          <StyledFormLabel htmlFor={field} required={required}>
            {parameter.title}
          </StyledFormLabel>
          {parameter?.description && (
            <InfoTooltip tooltip={parameter.description} />
          )}
        </StyledAlignment>
        <FormItem>
          <Select
            onChange={handleOptionChange}
            options={parameter.enum.map((value: string) => ({
              value,
              label: value,
            }))}
            value={
              db?.parameters?.[field as keyof DatabaseParameters] ||
              parameter?.default
            }
          />
        </FormItem>
      </StyledFormGroup>
    );
  }

  // text/number inputs
  return (
    <ValidatedInput
      id={field}
      name={field}
      type={parameter.type === 'integer' ? 'number' : 'text'}
      required={required}
      value={
        db?.parameters?.[field as keyof DatabaseParameters] ||
        parameter?.default
      }
      validationMethods={{ onBlur: getValidation }}
      errorMessage={validationErrors?.[field]}
      placeholder={parameter?.['x-placeholder']}
      helpText={parameter?.['x-help-text']}
      label={parameter.title}
      hasTooltip={!!parameter?.description}
      tooltipText={parameter?.description}
      onChange={changeMethods.onParametersChange}
    />
  );
};
