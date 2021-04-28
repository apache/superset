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
import cx from 'classnames';
import { FormGroup, FormControl } from 'react-bootstrap';
import FormLabel from 'src/components/Form/FormLabel';

export const FormFieldOrder = [
  'host',
  'port',
  'database',
  'username',
  'password',
];

const FORM_FIELD_MAP = {
  host: {
    description: 'Host',
    type: 'text',
    className: 'w-50',
    placeholder: 'e.g. 127.0.0.1',
  },
  port: {
    description: 'Port',
    type: 'text',
    className: 'w-50',
    placeholder: 'e.g. 5432',
  },
  database: {
    description: 'Database name',
    type: 'text',
    label:
      'Copy the name of the PostgreSQL database you are trying to connect to.',
    placeholder: 'e.g. world_population',
  },
  username: {
    description: 'Username',
    type: 'text',
    placeholder: 'e.g. Analytics',
  },
  password: {
    description: 'Password',
    type: 'text',
    placeholder: 'e.g. ********',
  },
  query: {
    additionalProperties: {},
    description: 'Additional parameters',
    type: 'object',
  },
};

const DatabaseConnectionForm = ({
  field,
  required,
}: {
  field: string;
  required: boolean;
}) => {
  const inputObj = FORM_FIELD_MAP[field];
  return (
    <FormGroup
      className={cx(inputObj.className && `form-group-${inputObj.className}`)}
    >
      <FormLabel htmlFor={field} required={required}>
        {inputObj.description}
      </FormLabel>
      <FormControl
        type={inputObj.text}
        id={field}
        bsSize="sm"
        autoComplete="off"
        onChange={() => {}}
        placeholder={inputObj.placeholder}
      />
      <p className="helper">{inputObj.label}</p>
    </FormGroup>
  );
};

export const FormFieldMap = FORM_FIELD_MAP;

export default DatabaseConnectionForm;
