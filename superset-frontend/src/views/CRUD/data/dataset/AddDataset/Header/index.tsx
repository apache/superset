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
import { t } from '@superset-ui/core';
import { PageHeaderWithActions } from 'src/components/PageHeaderWithActions';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import { Menu } from 'src/components/Menu';
import { TooltipPlacement } from 'src/components/Tooltip';
import {
  HeaderComponentStyles,
  disabledSaveBtnStyles,
} from 'src/views/CRUD/data/dataset/styles';
import {
  DatasetActionType,
  DSReducerActionType,
} from 'src/views/CRUD/data/dataset/AddDataset/types';

export const DEFAULT_TITLE = t('New dataset');

const tooltipProps: { text: string; placement: TooltipPlacement } = {
  text: t('Select a database table and create dataset'),
  placement: 'bottomRight',
};

const renderDisabledSaveButton = () => (
  <Button
    buttonStyle="primary"
    tooltip={tooltipProps?.text}
    placement={tooltipProps?.placement}
    disabled
    css={disabledSaveBtnStyles}
  >
    <Icons.Save iconSize="m" />
    {t('Save')}
  </Button>
);

const renderOverlay = () => (
  <Menu>
    <Menu.Item>{t('Settings')}</Menu.Item>
    <Menu.Item>{t('Delete')}</Menu.Item>
  </Menu>
);

export default function Header({
  setDataset,
  title = DEFAULT_TITLE,
}: {
  setDataset: React.Dispatch<DSReducerActionType>;
  title?: string | null | undefined;
  schema?: string | null | undefined;
}) {
  const editableTitleProps = {
    title: title ?? DEFAULT_TITLE,
    placeholder: DEFAULT_TITLE,
    onSave: (newDatasetName: string) => {
      setDataset({
        type: DatasetActionType.changeDataset,
        payload: { name: 'dataset_name', value: newDatasetName },
      });
    },
    canEdit: false,
    label: t('dataset name'),
  };

  return (
    <HeaderComponentStyles>
      <PageHeaderWithActions
        editableTitleProps={editableTitleProps}
        showTitlePanelItems={false}
        showFaveStar={false}
        faveStarProps={{ itemId: 1, saveFaveStar: () => {} }}
        titlePanelAdditionalItems={<></>}
        rightPanelAdditionalItems={renderDisabledSaveButton()}
        additionalActionsMenu={renderOverlay()}
        menuDropdownProps={{
          disabled: true,
        }}
        tooltipProps={tooltipProps}
      />
    </HeaderComponentStyles>
  );
}
