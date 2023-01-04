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
import React, { useEffect, useState } from 'react';
import { styled, css, t, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
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
    padding: ${theme.gridUnit}px;
    border: solid 1px ${theme.colors.grayscale.light2};
    border-radius: ${theme.gridUnit}px;
  `}
`;

export const UrlLinkContainer = styled(OptionControlContainer)`
  &,
  & > div {
    margin-bottom: ${({ theme }) => theme.gridUnit}px;
    :last-child {
      margin-bottom: 0;
    }
  }
`;

export const CloseButton = styled.button`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.light1};
    height: 100%;
    width: ${theme.gridUnit * 6}px;
    border: none;
    border-right: solid 1px ${theme.colors.grayscale.dark2}0C;
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
  const theme = useTheme();
  const [urlLinkConfigs, setUrlLinkConfigs] = useState<UrlLinkConfig[]>(
    value ?? [],
  );

  useEffect(() => {
    if (onChange) {
      onChange(urlLinkConfigs);
    }
  }, [urlLinkConfigs, onChange]);

  const onDelete = (index: number) => {
    setUrlLinkConfigs(prevConfigs => prevConfigs.filter((_, i) => i !== index));
  };

  const onSave = (config: UrlLinkConfig) => {
    setUrlLinkConfigs(prevConfigs => [...prevConfigs, config]);
  };

  const onEdit = (newConfig: UrlLinkConfig, index: number) => {
    const newConfigs = [...urlLinkConfigs];
    newConfigs.splice(index, 1, newConfig);
    setUrlLinkConfigs(newConfigs);
  };

  return (
    <div>
      <ControlHeader {...props} />
      <UrlLinksContainer>
        {urlLinkConfigs.map((config, index) => (
          <UrlLinkContainer key={index}>
            <CloseButton onClick={() => onDelete(index)}>
              <Icons.XSmall iconColor={theme.colors.grayscale.light1} />
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
                  <Icons.CaretRight iconColor={theme.colors.grayscale.light1} />
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
            <Icons.PlusSmall iconColor={theme.colors.grayscale.light1} />
            {t('Add new url link')}
          </AddControlLabel>
        </UrlLinkPopover>
      </UrlLinksContainer>
    </div>
  );
};

export default UrlLinkControl;
