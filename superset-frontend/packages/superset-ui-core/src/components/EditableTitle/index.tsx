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

import { css, styled, t } from '@superset-ui/core';
import { useEffect, useState, useRef } from 'react';
import cx from 'classnames';
import { Tooltip } from '../Tooltip';
import { CertifiedBadge } from '../CertifiedBadge';
import { Input, TextAreaRef } from '../Input';
import type { EditableTitleProps } from './types';

const StyledCertifiedBadge = styled(CertifiedBadge)`
  vertical-align: middle;
`;

const StyledEditableTitle = styled.span<{
  editing: boolean;
  canEdit: boolean;
}>`
  &.editable-title {
    display: inline;
    &.editable-title--editing {
      width: 100%;
    }

    input,
    textarea {
      outline: none;
      background: transparent;
      box-shadow: none;
      cursor: initial;
      font-feature-settings:
        'liga' 0,
        'calt' 0;
      font-variant-ligatures: none;
      font-weight: bold;
    }

    input[type='text'],
    textarea {
      color: ${({ theme }) => theme.colorTextTertiary};
      border-radius: ${({ theme }) => theme.sizeUnit}px;
      font-size: ${({ theme }) => theme.fontSizeLG}px;
      padding: ${({ theme }) => theme.sizeUnit / 2}px;
      min-height: 100px;
      width: 95%;
    }

    &.datasource-sql-expression {
      min-width: 315px;
      width: 100%;
    }
  }
`;

export function EditableTitle({
  canEdit = false,
  editing = false,
  extraClasses,
  noPermitTooltip,
  onSaveTitle,
  showTooltip = true,
  style,
  title = '',
  defaultTitle = '',
  placeholder = '',
  certifiedBy,
  certificationDetails,
  renderLink,
  maxWidth,
  autoSize = true,
  ...rest
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(editing);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [lastTitle, setLastTitle] = useState(title);
  const [inputWidth, setInputWidth] = useState<number>(0);
  const contentRef = useRef<TextAreaRef>(null);

  function measureTextWidth(text: string, font = '14px Arial') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      context.font = font;
      return context.measureText(text).width;
    }
    return 0;
  }

  useEffect(() => {
    const { font } = window.getComputedStyle(
      contentRef.current?.resizableTextArea?.textArea || document.body,
    );
    const textWidth = measureTextWidth(currentTitle || '', font);
    const padding = 20;
    const maxAllowedWidth = typeof maxWidth === 'number' ? maxWidth : Infinity;
    setInputWidth(Math.min(textWidth + padding, maxAllowedWidth));
  }, [currentTitle]);

  useEffect(() => {
    if (title !== currentTitle) {
      setLastTitle(currentTitle);
      setCurrentTitle(title);
    }
  }, [title]);

  useEffect(() => {
    if (isEditing && contentRef.current) {
      const textArea = contentRef.current.resizableTextArea?.textArea;
      if (textArea) {
        textArea.focus();
        const { length } = textArea.value;
        textArea.setSelectionRange(length, length);
        textArea.scrollTop = textArea.scrollHeight;
      }
    }
  }, [isEditing]);

  function handleClick() {
    if (!canEdit || isEditing) return;
    const textArea = contentRef.current?.resizableTextArea?.textArea;
    if (textArea) {
      textArea.focus();
      const { length } = textArea.value;
      textArea.setSelectionRange(length, length);
    }
    setIsEditing(true);
  }

  function handleBlur() {
    const formattedTitle = currentTitle.trim();

    if (!canEdit) return;
    setIsEditing(false);

    if (!formattedTitle.length) {
      setCurrentTitle(lastTitle);
      return;
    }

    if (lastTitle !== formattedTitle) {
      setLastTitle(formattedTitle);
    }

    if (title !== formattedTitle) {
      onSaveTitle(formattedTitle);
    }
  }

  function handleKeyDown(event: any) {
    const stopPropagationKeys = [
      'Backspace',
      'Delete',
      ' ',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
    ];

    if (stopPropagationKeys.includes(event.key)) {
      event.stopPropagation();
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      handleBlur();
    }
  }

  function handleChange(event: any) {
    if (!canEdit) return;
    setCurrentTitle(event.target.value);
  }

  function handleKeyPress(event: React.KeyboardEvent) {
    event.preventDefault();
    handleBlur();
  }

  let value: string | undefined = currentTitle;
  if (!isEditing && !currentTitle) {
    value = defaultTitle || title;
  }

  let titleComponent: React.ReactNode = (
    <Input.TextArea
      size="small"
      data-test="textarea-editable-title-input"
      ref={contentRef}
      value={value}
      className={!title ? 'text-muted' : undefined}
      onChange={handleChange}
      onBlur={handleBlur}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPressEnter={handleKeyPress}
      placeholder={placeholder}
      variant={isEditing ? 'outlined' : 'borderless'}
      autoSize={autoSize ? { minRows: 1, maxRows: 3 } : false}
      css={theme => css`
        && {
          width: ${inputWidth}px;
          min-width: ${theme.sizeUnit * 10}px;
          transition: auto;
        }
      `}
    />
  );

  if (showTooltip && !isEditing) {
    titleComponent = (
      <Tooltip
        id="title-tooltip"
        placement="topLeft"
        title={
          canEdit
            ? t('Click to edit')
            : noPermitTooltip ||
              t("You don't have the rights to alter this title.")
        }
      >
        {titleComponent}
      </Tooltip>
    );
  }

  if (!canEdit) {
    if (renderLink) {
      // New approach: let caller provide the link component
      titleComponent = renderLink(value || '');
    } else {
      titleComponent = <span data-test="span-title">{value}</span>;
    }
  }

  return (
    <StyledEditableTitle
      data-test="editable-title"
      className={cx(
        'editable-title',
        extraClasses,
        canEdit && 'editable-title--editable',
        isEditing && 'editable-title--editing',
      )}
      style={style}
      editing={isEditing}
      canEdit={canEdit}
      {...rest}
    >
      {certifiedBy && (
        <>
          <StyledCertifiedBadge
            certifiedBy={certifiedBy}
            details={certificationDetails}
            size="xl"
          />{' '}
        </>
      )}
      {titleComponent}
    </StyledEditableTitle>
  );
}

export type { EditableTitleProps };
