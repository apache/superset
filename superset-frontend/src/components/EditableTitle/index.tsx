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
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import cx from 'classnames';
import { css, styled, SupersetTheme, t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import CertifiedBadge from '../CertifiedBadge';

export interface EditableTitleProps {
  canEdit?: boolean;
  editing?: boolean;
  emptyText?: string;
  extraClasses?: Array<string> | string;
  multiLine?: boolean;
  noPermitTooltip?: string;
  onSaveTitle: (arg0: string) => void;
  showTooltip?: boolean;
  style?: object;
  title?: string;
  defaultTitle?: string;
  placeholder?: string;
  certifiedBy?: string;
  certificationDetails?: string;
  url?: string;
}

const StyledCertifiedBadge = styled(CertifiedBadge)`
  vertical-align: middle;
`;

export default function EditableTitle({
  canEdit = false,
  editing = false,
  extraClasses,
  multiLine = false,
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
  // rest is related to title tooltip
  ...rest
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(editing);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [lastTitle, setLastTitle] = useState(title);
  const [contentBoundingRect, setContentBoundingRect] =
    useState<DOMRect | null>(null);
  // Used so we can access the DOM element if a user clicks on this component.

  const contentRef = useRef<any | HTMLInputElement | HTMLTextAreaElement>();

  useEffect(() => {
    if (title !== currentTitle) {
      setLastTitle(currentTitle);
      setCurrentTitle(title);
    }
  }, [title]);

  useEffect(() => {
    if (isEditing) {
      contentRef.current.focus();
      // move cursor and scroll to the end
      if (contentRef.current.setSelectionRange) {
        const { length } = contentRef.current.value;
        contentRef.current.setSelectionRange(length, length);
        contentRef.current.scrollLeft = contentRef.current.scrollWidth;
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    }
  }, [isEditing]);

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

  // tl;dr when a EditableTitle is being edited, typically the Tab that wraps it has been
  // clicked and is focused/active. For accessibility, when the focused tab anchor intercepts
  // the ' ' key (among others, including all arrows) the onChange() doesn't fire. Somehow
  // keydown is still called so we can detect this and manually add a ' ' to the current title
  function handleKeyDown(event: any) {
    if (event.key === ' ') {
      event.stopPropagation();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      handleBlur();
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
  value = currentTitle;
  if (!isEditing && !currentTitle) {
    value = defaultTitle || title;
  }

  // Construct an inline style based on previously-saved height of the rendered label. Only
  // used in multi-line contexts.
  const editStyle =
    isEditing && contentBoundingRect
      ? { height: `${contentBoundingRect.height}px` }
      : undefined;

  // Create a textarea when we're editing a multi-line value, otherwise create an input (which may
  // be text or a button).
  let titleComponent =
    multiLine && isEditing ? (
      <textarea
        data-test="editable-title-input"
        ref={contentRef}
        value={value}
        className={!title ? 'text-muted' : undefined}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        style={editStyle}
      />
    ) : (
      <input
        data-test="editable-title-input"
        ref={contentRef}
        type={isEditing ? 'text' : 'button'}
        value={value}
        className={!title ? 'text-muted' : undefined}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
      />
    );
  if (showTooltip && !isEditing) {
    titleComponent = (
      <Tooltip
        id="title-tooltip"
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
        data-test="editable-title-input"
        css={(theme: SupersetTheme) => css`
          color: ${theme.colors.grayscale.dark1};
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
      <span data-test="editable-title-input">{value}</span>
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
