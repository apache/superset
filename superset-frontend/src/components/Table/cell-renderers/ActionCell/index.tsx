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
import { useState, useEffect } from 'react';
import { styled } from '@superset-ui/core';
import { Dropdown, IconOrientation } from 'src/components/Dropdown';
import { Menu } from 'src/components/Menu';
import { MenuProps } from 'antd/lib/menu';

/**
 * Props interface for Action Cell Renderer
 */
export interface ActionCellProps {
  /**
   * The Menu option presented to user when menu displays
   */
  menuOptions: ActionMenuItem[];
  /**
   * Object representing the data rendering the Table row with attribute for each column
   */
  row: object;
}

export interface ActionMenuItem {
  /**
   * Click handler specific to the menu item
   * @param menuItem The definition of the menu item that was clicked
   * @returns ActionMenuItem
   */
  onClick: (menuItem: ActionMenuItem) => void;
  /**
   * Label user will see displayed in the list of menu options
   */
  label: string;
  /**
   * Optional tooltip user will see if they hover over the menu option to get more context
   */
  tooltip?: string;
  /**
   * Optional variable that can contain data relevant to the menu item that you
   * want easy access to in the callback function for the menu
   */
  payload?: any;
  /**
   * Object representing the data rendering the Table row with attribute for each column
   */
  row?: object;
}

/**
 * Props interface for ActionMenu
 */
export interface ActionMenuProps {
  menuOptions: ActionMenuItem[];
  setVisible: (visible: boolean) => void;
}

const SHADOW =
  'box-shadow: 0px 3px 6px -4px rgba(0, 0, 0, 0.12), 0px 9px 28px 8px rgba(0, 0, 0, 0.05)';
const FILTER = 'drop-shadow(0px 6px 16px rgba(0, 0, 0, 0.08))';

const StyledMenu = styled(Menu)`
  box-shadow: ${SHADOW} !important;
  filter: ${FILTER} !important;
  border-radius: 2px !important;
  -webkit-box-shadow: ${SHADOW} !important;
`;

export const appendDataToMenu = (
  options: ActionMenuItem[],
  row: object,
): ActionMenuItem[] => {
  const newOptions = options?.map?.(option => ({
    ...option,
    row,
  }));
  return newOptions;
};

function ActionMenu(props: ActionMenuProps) {
  const { menuOptions, setVisible } = props;
  const handleClick: MenuProps['onClick'] = ({ key }) => {
    setVisible?.(false);
    const menuItem = menuOptions[key];
    if (menuItem) {
      menuItem?.onClick?.(menuItem);
    }
  };

  return (
    <StyledMenu onClick={handleClick}>
      {menuOptions?.map?.((option: ActionMenuItem, index: number) => (
        <Menu.Item key={index}>{option?.label}</Menu.Item>
      ))}
    </StyledMenu>
  );
}

export function ActionCell(props: ActionCellProps) {
  const { menuOptions, row } = props;
  const [visible, setVisible] = useState(false);
  const [appendedMenuOptions, setAppendedMenuOptions] = useState(
    appendDataToMenu(menuOptions, row),
  );

  useEffect(() => {
    const newOptions = appendDataToMenu(menuOptions, row);
    setAppendedMenuOptions(newOptions);
  }, [menuOptions, row]);

  const handleVisibleChange = (flag: boolean) => {
    setVisible(flag);
  };
  return (
    <Dropdown
      iconOrientation={IconOrientation.Horizontal}
      onVisibleChange={handleVisibleChange}
      trigger={['click']}
      overlay={
        <ActionMenu menuOptions={appendedMenuOptions} setVisible={setVisible} />
      }
      disabled={
        !(appendedMenuOptions?.length && appendedMenuOptions.length > 0)
      }
      visible={visible}
    />
  );
}

export default ActionCell;
