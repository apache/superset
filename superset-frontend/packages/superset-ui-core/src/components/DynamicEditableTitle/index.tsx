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
import {
  ChangeEvent,
  KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { css, SupersetTheme, t, useTheme } from '@superset-ui/core';
import { useResizeDetector } from 'react-resize-detector';
import { Tooltip } from '../Tooltip';
import { Input } from '../Input';
import type { DynamicEditableTitleProps } from './types';

const titleStyles = (theme: SupersetTheme) => css`
  display: flex;
  font-size: ${theme.fontSizeXL}px;
  font-weight: ${theme.fontWeightStrong};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  & .dynamic-title-input {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0;
    color: ${theme.colorText};
    background-color: ${theme.colorBgContainer};

    &::placeholder {
      color: ${theme.colorTextTertiary};
    }
  }

  & .input-sizer {
    position: absolute;
    display: inline-block;
    white-space: pre;
    opacity: 0;
  }
`;

export const DynamicEditableTitle = memo(
  ({
    title,
    placeholder,
    onSave,
    canEdit,
    label,
  }: DynamicEditableTitleProps) => {
    const theme = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [currentTitle, setCurrentTitle] = useState(title || '');

    const { width: inputWidth, ref: sizerRef } = useResizeDetector();
    const { width: containerWidth, ref: containerRef } = useResizeDetector({
      refreshMode: 'debounce',
    });

    useEffect(() => {
      setCurrentTitle(title);
    }, [title]);
    useEffect(() => {
      if (isEditing && sizerRef?.current) {
        // move cursor and scroll to the end
        if (sizerRef.current.setSelectionRange) {
          const { length } = sizerRef.current.value;
          sizerRef.current.setSelectionRange(length, length);
          sizerRef.current.scrollLeft =
            theme.direction === 'rtl' ? 0 : sizerRef.current.scrollWidth;
        }
      }
    }, [isEditing]);

    // a trick to make the input grow when user types text
    // we make additional span component, place it somewhere out of view and copy input
    // then we can measure the width of that span to resize the input element
    useLayoutEffect(() => {
      if (sizerRef?.current) {
        sizerRef.current.textContent = currentTitle || placeholder;
      }
    }, [currentTitle, placeholder, sizerRef]);

    useEffect(() => {
      const inputElement = sizerRef.current?.input;

      if (inputElement) {
        if (inputElement.scrollWidth > inputElement.clientWidth) {
          setShowTooltip(true);
        } else {
          setShowTooltip(false);
        }
      }
    }, [inputWidth, containerWidth]);

    const handleClick = useCallback(() => {
      if (!canEdit || isEditing) {
        return;
      }
      setIsEditing(true);
    }, [canEdit, isEditing]);

    const handleBlur = useCallback(() => {
      if (!canEdit) {
        return;
      }
      const formattedTitle = currentTitle.trim();
      setCurrentTitle(formattedTitle);
      if (title !== formattedTitle) {
        onSave(formattedTitle);
      }
      setIsEditing(false);
    }, [canEdit, currentTitle, onSave, title]);

    const handleChange = useCallback(
      (ev: ChangeEvent<HTMLInputElement>) => {
        if (!canEdit || !isEditing) {
          return;
        }
        setCurrentTitle(ev.target.value);
      },
      [canEdit, isEditing],
    );

    const handleKeyPress = useCallback(
      (ev: KeyboardEvent<HTMLInputElement>) => {
        if (!canEdit) {
          return;
        }
        ev.preventDefault();
        const { activeElement } = document;
        if (activeElement && activeElement instanceof HTMLElement) {
          activeElement.blur();
        }
      },
      [canEdit],
    );

    return (
      <div css={titleStyles} ref={containerRef}>
        <Tooltip
          id="title-tooltip"
          title={
            showTooltip && currentTitle && !isEditing ? currentTitle : null
          }
        >
          <Input
            data-test="editable-title-input"
            variant="borderless"
            aria-label={label ?? t('Title')}
            className="dynamic-title-input"
            value={currentTitle}
            onChange={handleChange}
            onBlur={handleBlur}
            onClick={handleClick}
            onPressEnter={handleKeyPress}
            placeholder={placeholder}
            css={css`
              ${!canEdit &&
              `&[disabled] {
                  cursor: default;
                }
              `}
              font-size: ${theme.fontSizeXL}px;
              transition: auto;
              ${inputWidth &&
              inputWidth > 0 &&
              css`
                width: ${inputWidth}px;
              `}
            `}
            disabled={!canEdit}
          />
        </Tooltip>
        <span
          ref={sizerRef}
          className="input-sizer"
          aria-hidden
          tabIndex={-1}
        />
      </div>
    );
  },
);
export type { DynamicEditableTitleProps } from './types';
