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
import { FC } from 'react';
import { t } from '@apache-superset/core';
import { NativeFilterType, ChartCustomizationType } from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/ui';
import { Button, Dropdown, Menu } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

interface Props {
  onAddFilter: (type: NativeFilterType) => void;
  onAddCustomization: (type: ChartCustomizationType) => void;
}

const NewItemDropdown: FC<Props> = ({ onAddFilter, onAddCustomization }) => {
  const theme = useTheme();

  const menu = (
    <Menu
      onClick={({ key }) => {
        if (key === 'filter') {
          onAddFilter(NativeFilterType.NativeFilter);
        } else if (key === 'customization') {
          onAddCustomization(ChartCustomizationType.ChartCustomization);
        } else if (key === 'divider') {
          onAddFilter(NativeFilterType.Divider);
        }
      }}
      items={[
        {
          key: 'filter',
          label: t('Add filter'),
          icon: (
            <Icons.FilterOutlined iconColor={theme.colorPrimary} iconSize="m" />
          ),
        },
        {
          key: 'customization',
          label: t('Add display control'),
          icon: (
            <Icons.SettingOutlined
              iconColor={theme.colorPrimary}
              iconSize="m"
            />
          ),
        },
        {
          key: 'divider',
          label: t('Add divider'),
          icon: (
            <Icons.PicCenterOutlined
              iconColor={theme.colorPrimary}
              iconSize="m"
            />
          ),
        },
      ]}
    />
  );

  return (
    <Dropdown overlay={menu} trigger={['hover']}>
      <Button
        buttonSize="default"
        buttonStyle="secondary"
        icon={
          <Icons.PlusOutlined iconColor={theme.colorPrimary} iconSize="m" />
        }
        data-test="new-item-dropdown-button"
      >
        {t('New')}
      </Button>
    </Dropdown>
  );
};

export default NewItemDropdown;
