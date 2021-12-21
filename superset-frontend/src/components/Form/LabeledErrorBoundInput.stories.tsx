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
import LabeledErrorBoundInput, {
  LabeledErrorBoundInputProps,
} from './LabeledErrorBoundInput';

export default {
  title: 'LabeledErrorBoundInput',
  component: LabeledErrorBoundInput,
};

export const InteractiveLabeledErrorBoundInput = ({
  name,
  value,
  placeholder,
  type,
  id,
  tooltipText,
}: LabeledErrorBoundInputProps) => {
  const [currentValue, setCurrentValue] = useState(value);

  const validateFunctionality: (value: any) => string = value => {
    setCurrentValue(value.target.value);
    if (value.target.value.includes('success')) {
      return 'success';
    }
    return 'error';
  };

  return (
    <LabeledErrorBoundInput
      id={id}
      name={name}
      validationMethods={{ onChange: validateFunctionality }}
      errorMessage={
        currentValue === 'success' ? '' : 'Type success in the text bar'
      }
      helpText="This is a line of example help text"
      value={currentValue}
      // This must stay the same as name or form breaks
      label={name}
      placeholder={placeholder}
      type={type}
      required
      hasTooltip
      tooltipText={tooltipText}
    />
  );
};

InteractiveLabeledErrorBoundInput.args = {
  name: 'Username',
  placeholder: 'Example placeholder text...',
  id: 1,
  tooltipText: 'This is a tooltip',
};

InteractiveLabeledErrorBoundInput.argTypes = {
  type: {
    defaultValue: 'textbox',
    control: {
      type: 'select',
      options: ['textbox', 'checkbox', 'radio'],
    },
  },
};
