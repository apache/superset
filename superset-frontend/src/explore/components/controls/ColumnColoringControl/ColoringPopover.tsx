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
import { useCallback, useState } from 'react';
import Popover from 'src/components/Popover';
import { ColoringPopoverContent } from './ColoringPopoverContent';
import { ColumnColoringConfig, ColoringPopoverProps } from './types';

export const ColoringPopover = ({
  title,
  columns,
  onChange,
  config,
  children,
  extraColorChoices,
  ...props
}: ColoringPopoverProps) => {
  const [visible, setVisible] = useState(false);

  const handleSave = useCallback(
    (newConfig: ColumnColoringConfig) => {
      setVisible(false);
      onChange(newConfig);
    },
    [onChange],
  );

  return (
    <Popover
      title={title}
      content={
        <ColoringPopoverContent
          onChange={handleSave}
          config={config}
          columns={columns}
        />
      }
      open={visible}
      onOpenChange={setVisible}
      trigger={['click']}
      overlayStyle={{ width: '450px' }}
      {...props}
    >
      {children}
    </Popover>
  );
};
