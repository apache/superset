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
import { useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled, css } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import ControlHeader from 'src/explore/components/ControlHeader';
import { UrlLinkPopover } from './UrlLinkPopover';
import { UrlLinkConfig, UrlLinkControlProps } from './types';
import {
  AddControlLabel,
  CaretContainer,
  Label,
  OptionControlContainer,
} from '../OptionControls';

const UrlLinksContainer = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit}px;
    border: solid 1px ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
  `}
`;

export const UrlLinkContainer = styled(OptionControlContainer)`
  &,
  & > div {
    margin-bottom: ${({ theme }) => theme.sizeUnit}px;
    :last-child {
      margin-bottom: 0;
    }
  }
`;

export const CloseButton = styled.button`
  ${({ theme }) => css`
    background: ${theme.colorBgLayout};
    color: ${theme.colorIcon};
    height: 100%;
    width: ${theme.sizeUnit * 6}px;
    border: none;
    border-right: solid 1px ${theme.colorBorder};
    padding: 0;
    outline: none;
    border-bottom-left-radius: 3px;
    border-top-left-radius: 3px;
  `}
`;

const UrlLinkControl = ({
  value,
  onChange,
  colnames,
  ...props
}: UrlLinkControlProps) => {
  const [urlLinkConfigs, setUrlLinkConfigs] = useState<UrlLinkConfig[]>(
    value ?? [],
  );

  const onDelete = (index: number) => {
    const newConfigs = urlLinkConfigs.filter((_, i) => i !== index);
    setUrlLinkConfigs(newConfigs);
    onChange?.(newConfigs);
  };

  const onSave = (config: UrlLinkConfig) => {
    const newConfigs = [...urlLinkConfigs, config];
    setUrlLinkConfigs(newConfigs);
    onChange?.(newConfigs);
  };

  const onEdit = (newConfig: UrlLinkConfig, index: number) => {
    const newConfigs = [...urlLinkConfigs];
    newConfigs.splice(index, 1, newConfig);
    setUrlLinkConfigs(newConfigs);
    onChange?.(newConfigs);
  };

  return (
    <div>
      <ControlHeader {...props} />
      <UrlLinksContainer>
        {urlLinkConfigs.map((config, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <UrlLinkContainer key={index}>
            <CloseButton onClick={() => onDelete(index)}>
              <Icons.CloseOutlined iconSize="m" />
            </CloseButton>
            <UrlLinkPopover
              title={t('Edit url link')}
              config={config}
              columns={colnames}
              onChange={(newConfig: UrlLinkConfig) => onEdit(newConfig, index)}
              destroyTooltipOnHide
            >
              <OptionControlContainer withCaret>
                <Label>{config.columnName}</Label>
                <CaretContainer>
                  <Icons.RightOutlined iconSize="m" />
                </CaretContainer>
              </OptionControlContainer>
            </UrlLinkPopover>
          </UrlLinkContainer>
        ))}
        <UrlLinkPopover
          title={t('Add new link')}
          columns={colnames}
          onChange={onSave}
          destroyTooltipOnHide
        >
          <AddControlLabel>
            <Icons.PlusOutlined iconSize="m" />
            {t('Add new url link')}
          </AddControlLabel>
        </UrlLinkPopover>
      </UrlLinksContainer>
    </div>
  );
};

export default UrlLinkControl;
