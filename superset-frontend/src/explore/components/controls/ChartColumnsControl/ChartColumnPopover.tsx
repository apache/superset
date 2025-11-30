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

import { useState, useEffect, useCallback, useRef } from 'react';
import { t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { Popover, Input, Button, InputRef } from '@superset-ui/core/components';
import { ChartColumnPopoverProps, ChartColumnConfig } from './types';

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
  justify-content: space-between;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 6}px;
`;

const StyledButton = styled(Button)`
  flex: 1;
`;

export const ChartColumnPopover = ({
  onChange,
  config,
  title,
  children,
  ...popoverProps
}: ChartColumnPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState(config?.label || '');
  const inputRef = useRef<InputRef>(null);

  const handleSave = () => {
    const newConfig: ChartColumnConfig = {
      key: config?.key || `chart_${Date.now()}`,
      label: label || t('Chart Column'),
    };
    onChange(newConfig);
    setIsOpen(false);
    // reset for next add
    if (!config) {
      setLabel('');
    }
  };

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    // reset to original values if editing
    if (config) {
      setLabel(config.label);
    } else {
      setLabel('');
    }
  }, [config]);

  // focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus({ cursor: 'end' });
    }
  }, [isOpen]);

  // close popover on ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleCancel]);

  const content = (
    <PopoverContent>
      <FormItem>
        <Label>{t('Column Label')}</Label>
        <Input
          ref={inputRef}
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder={t('Enter column label')}
        />
      </FormItem>
      <ButtonContainer>
        <StyledButton buttonStyle="secondary" onClick={handleCancel}>
          {t('Close')}
        </StyledButton>
        <StyledButton
          buttonStyle="primary"
          onClick={handleSave}
          disabled={!label.trim()}
        >
          {t('Save')}
        </StyledButton>
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
      placement="right"
      {...popoverProps}
    >
      {children}
    </Popover>
  );
};
