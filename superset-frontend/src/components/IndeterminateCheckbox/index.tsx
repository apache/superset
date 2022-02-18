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
import React, { forwardRef, useRef, useEffect } from 'react';
import { styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';

export interface IndeterminateCheckboxProps {
  indeterminate: boolean;
  id: string;
  checked: boolean;
  onChange: React.EventHandler<React.SyntheticEvent<HTMLInputElement>>;
  title?: string;
  labelText?: string;
}

const CheckboxLabel = styled.label`
  cursor: pointer;
  display: inline-block;
  margin-bottom: 0;
`;

const CheckboxHalf = styled(Icons.CheckboxHalf)`
  color: ${({ theme }) => theme.colors.primary.base};
  cursor: pointer;
`;

const CheckboxOff = styled(Icons.CheckboxOff)`
  color: ${({ theme }) => theme.colors.grayscale.base};
  cursor: pointer;
`;

const CheckboxOn = styled(Icons.CheckboxOn)`
  color: ${({ theme }) => theme.colors.primary.base};
  cursor: pointer;
`;

const HiddenInput = styled.input`
  &[type='checkbox'] {
    cursor: pointer;
    opacity: 0;
    position: absolute;
    left: 3px;
    margin: 0;
    top: 4px;
  }
`;

const InputContainer = styled.div`
  cursor: pointer;
  display: inline-block;
  position: relative;
`;

const IndeterminateCheckbox = forwardRef(
  (
    {
      indeterminate,
      id,
      checked,
      onChange,
      title = '',
      labelText = '',
    }: IndeterminateCheckboxProps,
    ref: React.MutableRefObject<any>,
  ) => {
    const defaultRef = useRef<HTMLInputElement>();
    const resolvedRef = ref || defaultRef;

    useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate;
    }, [resolvedRef, indeterminate]);

    return (
      <>
        <InputContainer>
          {indeterminate && <CheckboxHalf />}
          {!indeterminate && checked && <CheckboxOn />}
          {!indeterminate && !checked && <CheckboxOff />}
          <HiddenInput
            name={id}
            id={id}
            type="checkbox"
            ref={resolvedRef}
            checked={checked}
            onChange={onChange}
          />
        </InputContainer>
        <CheckboxLabel title={title} htmlFor={id}>
          {labelText}
        </CheckboxLabel>
      </>
    );
  },
);

export default IndeterminateCheckbox;
