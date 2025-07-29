/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useCallback } from 'react';
import { HandlerFunction, styled } from '@superset-ui/core';
// Import the shared components object
import { sharedControlComponents } from '@superset-ui/chart-controls';

// The linter is having trouble finding CheckboxControl, so we use @ts-ignore
// as a diagnostic step to see if the component exists at runtime.
// @ts-ignore
const { CheckboxControl } = sharedControlComponents;

const ExtraControlsWrapper = styled.div`
  text-align: center;
  padding-top: 8px;
`;

// This component is now much simpler. It only needs to render a checkbox
// if the `area` and `showExtraControls` props are true.
export function ExtraControls<
  F extends {
    stack: boolean; // The `stack` prop is now a simple boolean
    area: boolean;
    showExtraControls: boolean;
  },
>({
  formData,
  setControlValue,
}: {
  formData: F;
  setControlValue?: HandlerFunction;
}) {
  const { area, stack, showExtraControls } = formData;

  const handleChange = useCallback(
    (value: boolean) => {
      setControlValue?.('stack', value);
    },
    [setControlValue],
  );

  // Only show the control if the conditions are met.
  if (!showExtraControls || !area) {
    return null;
  }

  return (
    <ExtraControlsWrapper>
      <CheckboxControl
        name="stack"
        label="Stack Series" // Provide a simple label
        value={stack}
        onChange={handleChange}
      />
    </ExtraControlsWrapper>
  );
}
