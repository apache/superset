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
import { Dropdown, IconOrientation } from 'src/components/Dropdown';
import { Menu } from 'src/components/Menu';
import { MenuProps } from 'antd/lib/menu';

export interface ActionCellProps {
  menuOptions: ActionMenuItem[];
}

export interface ActionMenuItem {
  onClick: (menuItem: ActionMenuItem) => void;
  label: string;
  tooltip?: string;
}

export interface ActionMenuProps {
  menuOptions: ActionMenuItem[];
  setVisible: (visible: boolean) => void;
}

function ActionMenu(props: ActionMenuProps) {
  const { menuOptions, setVisible } = props;

  const handleClick: MenuProps['onClick'] = ({ key, item }) => {
    setVisible?.(false);
    // const menuItem = menuOptions[item?.props?.index];
    const index = key?.split?.('_')?.[1] ?? -1;
    const menuItem = menuOptions[index];
    if (menuItem) {
      menuItem?.onClick?.(menuItem);
    }
  };

  return (
    <Menu onClick={handleClick}>
      {menuOptions?.map?.((menuOptions: ActionMenuItem) => (
        <Menu.Item>{menuOptions?.label ?? 'yo'}</Menu.Item>
      ))}
    </Menu>
  );
}

export function ActionCell(props: ActionCellProps) {
  const { menuOptions } = props;
  const [visible, setVisible] = useState(false);
  const handleVisibleChange = (flag: boolean) => {
    setVisible(flag);
  };
  return (
    <Dropdown
      orientation={IconOrientation.HORIZONTAL}
      onVisibleChange={handleVisibleChange}
      trigger={['click']}
      overlay={<ActionMenu menuOptions={menuOptions} setVisible={setVisible} />}
      disabled={!(menuOptions?.length && menuOptions.length > 0)}
      visible={visible}
    />
  );
}

export default ActionCell;
