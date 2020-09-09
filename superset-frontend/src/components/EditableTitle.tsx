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
import React, { useEffect, useState, useRef } from 'react';
import cx from 'classnames';
import { t } from '@superset-ui/core';
import TooltipWrapper from './TooltipWrapper';

interface EditableTitleProps {
  canEdit?: boolean;
  emptyText?: string;
  extraClasses?: Array<string> | string;
  multiLine?: boolean;
  noPermitTooltip?: string;
  onSaveTitle: (arg0: string) => {};
  showTooltip?: boolean;
  style?: object;
  title: string;
}

export default function EditableTitle({
  canEdit = false,
  emptyText,
  extraClasses,
  multiLine = false,
  noPermitTooltip,
  onSaveTitle,
  showTooltip = true,
  style,
  title,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [lastTitle, setLastTitle] = useState(title);
  const [
    contentBoundingRect,
    setContentBoundingRect,
  ] = useState<DOMRect | null>(null);
  // Used so we can access the DOM element if a user clicks on this component.

  const contentRef = useRef<any | HTMLInputElement | HTMLTextAreaElement>();

  useEffect(() => {
    if (currentTitle !== lastTitle) {
      setLastTitle(currentTitle);
      setCurrentTitle(title);
    }
  }, [title]);

  function handleClick() {
    if (!canEdit || isEditing) {
      return;
    }

    // For multi-line values, save the actual rendered size of the displayed text.
    // Later, if a textarea is constructed for editing the value, we'll need this.
    const contentBounding = contentRef.current
      ? contentRef.current.getBoundingClientRect()
      : null;
    setIsEditing(true);
    setContentBoundingRect(contentBounding);
  }

  function handleBlur() {
    const formattedTitle = currentTitle.trim();

    if (!canEdit) {
      return;
    }

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

  // this entire method exists to support using EditableTitle as the title of a
  // react-bootstrap Tab, as a workaround for this line in react-bootstrap https://goo.gl/ZVLmv4
  //
  // tl;dr when a Tab EditableTitle is being edited, typically the Tab it's within has been
  // clicked and is focused/active. for accessibility, when focused the Tab <a /> intercepts
  // the ' ' key (among others, including all arrows) and onChange() doesn't fire. somehow
  // keydown is still called so we can detect this and manually add a ' ' to the current title
  function handleKeyDown(event: any) {
    if (event.key === ' ') {
      event.stopPropagation();
    }
  }

  function handleChange(ev: any) {
    if (!canEdit) {
      return;
    }
    setCurrentTitle(ev.target.value);
  }

  function handleKeyPress(ev: any) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      handleBlur();
    }
  }

  let value: string | undefined;
  if (currentTitle) {
    value = currentTitle;
  } else if (!isEditing) {
    value = emptyText;
  }

  // Construct an inline style based on previously-saved height of the rendered label. Only
  // used in multi-line contexts.
  const editStyle =
    isEditing && contentBoundingRect
      ? { height: `${contentBoundingRect.height}px` }
      : undefined;

  // Create a textarea when we're editing a multi-line value, otherwise create an input (which may
  // be text or a button).
  let input =
    multiLine && isEditing ? (
      <textarea
        ref={contentRef}
        required
        value={value}
        className={!title ? 'text-muted' : undefined}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyPress={handleKeyPress}
        style={editStyle}
      />
    ) : (
      <input
        ref={contentRef}
        required
        type={isEditing ? 'text' : 'button'}
        value={value}
        className={!title ? 'text-muted' : undefined}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyPress={handleKeyPress}
      />
    );
  if (showTooltip && !isEditing) {
    input = (
      <TooltipWrapper
        label="title"
        tooltip={
          canEdit
            ? t('click to edit')
            : noPermitTooltip ||
              t("You don't have the rights to alter this title.")
        }
      >
        {input}
      </TooltipWrapper>
    );
  }
  return (
    <span
      className={cx(
        'editable-title',
        extraClasses,
        canEdit && 'editable-title--editable',
        isEditing && 'editable-title--editing',
      )}
      style={style}
    >
      {input}
    </span>
  );
}
