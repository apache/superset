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
import { t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { Popover, Input, Select } from '@superset-ui/core/components';
import { ChartColumnPopoverProps, ChartColumnConfig, ChartType } from './types';

const PopoverContent = styled.div`
  width: 300px;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const FormItem = styled.div`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 3}px;
`;

const Label = styled.div`
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const Button = styled.button<{ primary?: boolean }>`
  padding: ${({ theme }) => `${theme.sizeUnit}px ${theme.sizeUnit * 3}px`};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colorBorder};
  background-color: ${({ theme, primary }) =>
    primary ? theme.colorPrimary : theme.colorBgLayout};
  color: ${({ theme, primary }) =>
    primary ? theme.colorTextLightSolid : theme.colorText};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  &:hover {
    opacity: 0.8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ChartColumnPopover = ({
  onChange,
  config,
  title,
  children,
  ...popoverProps
}: ChartColumnPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [chartType, setChartType] = useState<ChartType>(
    config?.type || 'sparkline',
  );
  const [label, setLabel] = useState(config?.label || '');

  const handleSave = () => {
    const newConfig: ChartColumnConfig = {
      key: config?.key || `chart_${Date.now()}`,
      type: chartType,
      label: label || t('Chart Column'),
    };
    onChange(newConfig);
    setIsOpen(false);
    // Reset for next add
    if (!config) {
      setChartType('sparkline');
      setLabel('');
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    // Reset to original values if editing
    if (config) {
      setChartType(config.type);
      setLabel(config.label);
    } else {
      setChartType('sparkline');
      setLabel('');
    }
  };

  const content = (
    <PopoverContent>
      <FormItem>
        <Label>{t('Chart Type')}</Label>
        <Select
          value={chartType}
          onChange={(value: ChartType) => setChartType(value)}
          options={[
            { label: t('Sparkline'), value: 'sparkline' },
            { label: t('Mini Bar'), value: 'minibar' },
          ]}
          css={{ width: '100%' }}
        />
      </FormItem>
      <FormItem>
        <Label>{t('Column Label')}</Label>
        <Input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder={t('Enter column label')}
        />
      </FormItem>
      <ButtonContainer>
        <Button onClick={handleCancel}>{t('Cancel')}</Button>
        <Button primary onClick={handleSave} disabled={!label.trim()}>
          {t('Save')}
        </Button>
      </ButtonContainer>
    </PopoverContent>
  );

  return (
    <Popover
      content={content}
      title={title}
      trigger="click"
      open={isOpen}
      onOpenChange={setIsOpen}
      {...popoverProps}
    >
      {children}
    </Popover>
  );
};
