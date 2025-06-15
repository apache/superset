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
import { useEffect, useState } from 'react';
import { styled, css, t, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import ControlHeader from 'src/explore/components/ControlHeader';
import { ColoringPopover } from './ColoringPopover';
import { ColumnColoringConfig, ColumnColoringControlProps } from './types';
import {
  AddControlLabel,
  CaretContainer,
  Label,
  OptionControlContainer,
} from '../OptionControls';
import { ConditionalFormattingConfig } from '../ConditionalFormattingControl';

const FormattersContainer = styled.div`
  ${({ theme }) => css`
    padding: ${theme.gridUnit}px;
    border: solid 1px ${theme.colors.grayscale.light2};
    border-radius: ${theme.gridUnit}px;
  `}
`;

export const FormatterContainer = styled(OptionControlContainer)`
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

const ColumnColoringControl = ({
  value,
  onChange,
  columnOptions,
  verboseMap,
  removeIrrelevantConditions,
  extraColorChoices,
  ...props
}: ColumnColoringControlProps) => {
  const theme = useTheme();
  const [columnColoringConfigs, setColumnColoringConfigs] = useState<
    ColumnColoringConfig[]
  >(value ?? []);

  useEffect(() => {
    if (onChange) {
      onChange(columnColoringConfigs);
    }
  }, [columnColoringConfigs, onChange]);

  useEffect(() => {
    if (removeIrrelevantConditions) {
      // remove formatter when corresponding column is removed from controls
      const newColoringConfigs = columnColoringConfigs.filter(config =>
        columnOptions.some((option: any) => option?.value === config?.column),
      );
      if (
        newColoringConfigs.length !== columnColoringConfigs.length &&
        removeIrrelevantConditions
      ) {
        setColumnColoringConfigs(newColoringConfigs);
      }
    }
  }, [columnColoringConfigs, columnOptions, removeIrrelevantConditions]);

  const onDelete = (index: number) => {
    setColumnColoringConfigs(prevConfigs =>
      prevConfigs.filter((_, i) => i !== index),
    );
  };

  const onSave = (config: ConditionalFormattingConfig) => {
    setColumnColoringConfigs(prevConfigs => [...prevConfigs, config]);
  };

  const onEdit = (newConfig: ConditionalFormattingConfig, index: number) => {
    const newConfigs = [...columnColoringConfigs];
    newConfigs.splice(index, 1, newConfig);
    setColumnColoringConfigs(newConfigs);
  };

  const createLabel = ({ column }: ColumnColoringConfig) => {
    const columnName = (column && verboseMap?.[column]) ?? column;
    return `${columnName}`;
  };

  return (
    <div>
      <ControlHeader {...props} />
      <FormattersContainer>
        {columnColoringConfigs.map((config, index) => (
          <FormatterContainer key={index}>
            <CloseButton onClick={() => onDelete(index)}>
              <Icons.XSmall iconColor={theme.colors.grayscale.light1} />
            </CloseButton>
            <ColoringPopover
              title={t('Edit color')}
              config={config}
              columns={columnOptions}
              onChange={(newConfig: ColumnColoringConfig) =>
                onEdit(newConfig, index)
              }
              destroyTooltipOnHide
              extraColorChoices={extraColorChoices}
            >
              <OptionControlContainer withCaret>
                <Label>{createLabel(config)}</Label>
                <CaretContainer>
                  <Icons.CaretRight iconColor={theme.colors.grayscale.light1} />
                </CaretContainer>
              </OptionControlContainer>
            </ColoringPopover>
          </FormatterContainer>
        ))}
        <ColoringPopover
          title={t('Add new color')}
          columns={columnOptions}
          onChange={onSave}
          destroyTooltipOnHide
          extraColorChoices={extraColorChoices}
        >
          <AddControlLabel>
            <Icons.PlusSmall iconColor={theme.colors.grayscale.light1} />
            {t('Add new column color')}
          </AddControlLabel>
        </ColoringPopover>
      </FormattersContainer>
    </div>
  );
};

export default ColumnColoringControl;
