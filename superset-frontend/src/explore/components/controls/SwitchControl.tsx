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
import { type ReactNode } from 'react';
import { css } from '@apache-superset/core/theme';
import { Switch } from '@superset-ui/core/components';
import ControlHeader from '../ControlHeader';

interface SwitchControlProps {
  value?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  hovered?: boolean;
  onChange?: (value: boolean) => void;
  validationErrors?: string[];
}

export default function SwitchControl({
  value = false,
  onChange,
  ...props
}: SwitchControlProps) {
  const handleChange = (checked: boolean) => {
    onChange?.(checked);
  };

  const switchNode = (
    <Switch size="small" checked={!!value} onChange={handleChange} />
  );

  if (props.label) {
    return (
      <div
        css={css`
          .ControlHeader .pull-left {
            display: flex;
            align-items: center;
          }
        `}
      >
        <ControlHeader
          {...props}
          leftNode={switchNode}
          onClick={() => handleChange(!value)}
        />
      </div>
    );
  }
  return switchNode;
}
