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
import { FC, MouseEvent, ReactNode } from 'react';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';

/**
 * SkipLink - WCAG 2.4.1 Bypass Blocks.
 * Lets keyboard users skip the navigation and jump to the main content.
 * The link sits just above the viewport and moves into view when focused.
 */
const StyledSkipLink = styled.a`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10000;
  /* Translating by the link's own height keeps it fully off-screen at any
     text size, unlike a fixed negative offset. */
  transform: translateY(-100%);
  padding: ${({ theme }) => theme.sizeUnit * 3}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  background: ${({ theme }) => theme.colorPrimary};
  color: ${({ theme }) => theme.colorTextLightSolid};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  text-decoration: none;
  border-radius: 0 0 ${({ theme }) => theme.borderRadius}px
    ${({ theme }) => theme.borderRadius}px;

  &:focus,
  &:focus-visible {
    transform: none;
    outline: 3px solid ${({ theme }) => theme.colorPrimaryBorderHover};
    outline-offset: 2px;
  }
`;

interface SkipLinkProps {
  targetId?: string;
  children?: ReactNode;
}

const SkipLink: FC<SkipLinkProps> = ({
  targetId = 'main-content',
  children = t('Skip to main content'),
}) => {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById(targetId);
    if (!el) {
      window.location.hash = `#${targetId}`;
      return;
    }
    // tabindex="-1" makes the target programmatically focusable without
    // adding it to the tab order; it is removed on blur to restore the
    // element's original markup.
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
      el.addEventListener('blur', () => el.removeAttribute('tabindex'), {
        once: true,
      });
    }
    el.focus();
  };

  return (
    <StyledSkipLink href={`#${targetId}`} onClick={handleClick}>
      {children}
    </StyledSkipLink>
  );
};

export default SkipLink;
