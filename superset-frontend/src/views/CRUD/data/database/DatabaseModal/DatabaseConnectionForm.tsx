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
import React, { FormEvent } from 'react';
import cx from 'classnames';
import { InputProps } from 'antd/lib/input';
import { FormLabel, FormItem } from 'src/components/Form';
import { Input } from 'src/common/components';
import { StyledFormHeader, formScrollableStyles } from './styles';
import { DatabaseForm } from '../types';

export const FormFieldOrder = [
  'host',
  'port',
  'database',
  'username',
  'password',
  'database_name',
];

const CHANGE_METHOD = {
  onChange: 'onChange',
  onPropertiesChange: 'onPropertiesChange',
};

const FORM_FIELD_MAP = {
  host: {
    description: 'Host',
    type: 'text',
    className: 'w-50',
    placeholder: 'e.g. 127.0.0.1',
    changeMethod: CHANGE_METHOD.onPropertiesChange,
  },
  port: {
    description: 'Port',
    type: 'text',
    className: 'w-50',
    placeholder: 'e.g. 5432',
    changeMethod: CHANGE_METHOD.onPropertiesChange,
  },
  database: {
    description: 'Database name',
    type: 'text',
    label:
      'Copy the name of the PostgreSQL database you are trying to connect to.',
    placeholder: 'e.g. world_population',
    changeMethod: CHANGE_METHOD.onPropertiesChange,
  },
  username: {
    description: 'Username',
    type: 'text',
    placeholder: 'e.g. Analytics',
    changeMethod: CHANGE_METHOD.onPropertiesChange,
  },
  password: {
    description: 'Password',
    type: 'text',
    placeholder: 'e.g. ********',
    changeMethod: CHANGE_METHOD.onPropertiesChange,
  },
  database_name: {
    description: 'Display Name',
    type: 'text',
    label: 'Pick a nickname for this database to display as in Superset.',
    changeMethod: CHANGE_METHOD.onChange,
  },
  query: {
    additionalProperties: {},
    description: 'Additional parameters',
    type: 'object',
    changeMethod: CHANGE_METHOD.onPropertiesChange,
  },
};

const DatabaseConnectionForm = ({
  dbModel: { name, parameters },
  onParametersChange,
  onChange,
}: {
  dbModel: DatabaseForm;
  onParametersChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  onChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
}) => (
  <>
    <StyledFormHeader>
      <h4>Enter the required {name} credentials</h4>
      <p className="helper">
        Need help? Learn more about connecting to {name}.
      </p>
    </StyledFormHeader>
    <div css={formScrollableStyles}>
      {parameters &&
        FormFieldOrder.filter(
          (key: string) =>
            Object.keys(parameters.properties).includes(key) ||
            key === 'database_name',
        ).map(field => {
          const {
            className,
            description,
            type,
            placeholder,
            label,
            changeMethod,
          } = FORM_FIELD_MAP[field];
          const onEdit =
            changeMethod === CHANGE_METHOD.onChange
              ? onChange
              : onParametersChange;
          return (
            <FormItem
              className={cx(className, `form-group-${className}`)}
              key={field}
            >
              <FormLabel
                htmlFor={field}
                required={parameters.required.includes(field)}
              >
                {description}
              </FormLabel>
              <Input
                name={field}
                type={type}
                id={field}
                autoComplete="off"
                placeholder={placeholder}
                onChange={onEdit}
              />
              <p className="helper">{label}</p>
            </FormItem>
          );
        })}
    </div>
  </>
);

export const FormFieldMap = FORM_FIELD_MAP;

export default DatabaseConnectionForm;
