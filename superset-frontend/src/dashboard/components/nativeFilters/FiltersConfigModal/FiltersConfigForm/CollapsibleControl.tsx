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
import { ReactNode, useEffect, useState } from 'react';
import { styled } from '@superset-ui/core';
import { AntdCheckbox } from 'src/components';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

interface CollapsibleControlProps {
  initialValue?: boolean;
  disabled?: boolean;
  checked?: boolean;
  title: string;
  tooltip?: string;
  children: ReactNode;
  onChange?: (checked: boolean) => void;
}

const StyledContainer = styled.div<{ checked: boolean }>`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: ${({ theme }) => theme.gridUnit * 10}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2 + 2}px;

  .checkbox {
    margin-bottom: ${({ theme, checked }) => (checked ? theme.gridUnit : 0)}px;
  }

  & > div {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  }
`;

const ChildrenContainer = styled.div`
  margin-left: ${({ theme }) => theme.gridUnit * 6}px;
`;

const CollapsibleControl = (props: CollapsibleControlProps) => {
  const {
    checked,
    disabled,
    title,
    tooltip,
    children,
    onChange = () => {},
    initialValue = false,
  } = props;
  const [isChecked, setIsChecked] = useState(initialValue);

  useEffect(() => {
    // if external `checked` changed to `undefined`, it means that we work now in uncontrolled mode with local state
    // and we need ignore external value
    if (checked !== undefined) {
      setIsChecked(checked);
    }
  }, [checked]);

  return (
    <StyledContainer checked={isChecked}>
      <AntdCheckbox
        className="checkbox"
        checked={isChecked}
        disabled={disabled}
        onChange={e => {
          const value = e.target.checked;
          // external `checked` value has more priority then local state
          if (checked === undefined) {
            // uncontrolled mode
            setIsChecked(value);
          }
          onChange(value);
        }}
      >
        <>
          {title}&nbsp;
          {tooltip && (
            <InfoTooltipWithTrigger placement="top" tooltip={tooltip} />
          )}
        </>
      </AntdCheckbox>
      {isChecked && <ChildrenContainer>{children}</ChildrenContainer>}
    </StyledContainer>
  );
};

export { CollapsibleControl, CollapsibleControlProps };
