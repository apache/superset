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
import { css, styled, SupersetTheme, t } from '@superset-ui/core';
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import cx from 'classnames';
import { Tooltip } from '../Tooltip';
import { CertifiedBadge } from '../CertifiedBadge';
import { Input, TextAreaRef } from '../Input';
import type { EditableTitleProps } from './types';

const StyledCertifiedBadge = styled(CertifiedBadge)`
  vertical-align: middle;
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
  url,
  maxWidth,
  autoSize = true,
  // rest is related to title tooltip
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
      // set focus, move cursor and scroll to the end
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

  // tl;dr when a EditableTitle is being edited, typically the Tab that wraps it has been
  // clicked and is focused/active. For accessibility, when the focused tab anchor intercepts
  // the ' ' key (among others, including all arrows) the onChange() doesn't fire. Somehow
  // keydown is still called so we can detect this and manually add a ' ' to the current title
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

  let value: string | undefined;
  value = currentTitle;
  if (!isEditing && !currentTitle) {
    value = defaultTitle || title;
  }

  let titleComponent = (
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
    // don't actually want an input in this case
    titleComponent = url ? (
      <Link
        to={url}
        data-test="link-title"
        css={(theme: SupersetTheme) => css`
          color: ${theme.colorText};
          text-decoration: none;
          :hover {
            text-decoration: underline;
          }
          display: inline-block;
        `}
      >
        {value}
      </Link>
    ) : (
      <span data-test="span-title">{value}</span>
    );
  }
  return (
    <span
      data-test="editable-title"
      className={cx(
        'editable-title',
        extraClasses,
        canEdit && 'editable-title--editable',
        isEditing && 'editable-title--editing',
      )}
      style={style}
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
    </span>
  );
}

export type { EditableTitleProps };
