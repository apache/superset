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
import styled from '@superset-ui/style';
import { ReactComponent as CheckboxOnIcon } from 'images/icons/checkbox-on.svg';
import { ReactComponent as CheckboxOffIcon } from 'images/icons/checkbox-off.svg';
import { ReactComponent as CheckboxHalfIcon } from 'images/icons/checkbox-half.svg';

interface Props {
  indeterminate: boolean;
  id: string;
  checked: boolean;
  onChange: React.EventHandler<React.SyntheticEvent<HTMLInputElement>>;
  title?: string;
}

const CheckboxLabel = styled.label`
  cursor: pointer;
  margin-bottom: 0;
`;

const IndeterminateCheckbox = React.forwardRef(
  (
    { indeterminate, id, checked, onChange, title = '' }: Props,
    ref: React.MutableRefObject<any>,
  ) => {
    const defaultRef = React.useRef<HTMLInputElement>();
    const resolvedRef = ref || defaultRef;

    React.useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate;
    }, [resolvedRef, indeterminate]);

    return (
      <>
        <CheckboxLabel htmlFor={id} title={title}>
          {indeterminate && <CheckboxHalfIcon />}
          {!indeterminate && checked && <CheckboxOnIcon />}
          {!indeterminate && !checked && <CheckboxOffIcon />}
        </CheckboxLabel>
        <input
          className="hidden"
          name={id}
          id={id}
          type="checkbox"
          ref={resolvedRef}
          checked={checked}
          onChange={onChange}
        />
      </>
    );
  },
);

export default IndeterminateCheckbox;
