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
import { FC, MouseEvent } from 'react';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';

/**
 * SkipLink - WCAG 2.4.1 Bypass Blocks
 * Allows keyboard users to skip navigation and jump directly to main content.
 * The link is visually hidden but becomes visible when focused.
 */

const StyledSkipLink = styled.a`
  position: absolute;
  top: -100px;
  left: 0;
  background: ${({ theme }) => theme.colorPrimary};
  color: ${({ theme }) => theme.colorWhite};
  padding: ${({ theme }) => theme.sizeUnit * 3}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  z-index: 10000;
  text-decoration: none;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  border-radius: 0 0 ${({ theme }) => theme.borderRadius}px
    ${({ theme }) => theme.borderRadius}px;
  transition: top 0.2s ease-in-out;

  &:focus,
  &:focus-visible {
    top: 0 !important;
    outline: 3px solid ${({ theme }) => theme.colorPrimaryBorderHover};
    outline-offset: 2px;
  }

  &:hover {
    background: ${({ theme }) => theme.colorPrimaryHover};
  }
`;

interface SkipLinkProps {
  targetId?: string;
  children?: React.ReactNode;
}

const SkipLink: FC<SkipLinkProps> = ({
  targetId = 'main-content',
  children = t('Skip to main content'),
}) => {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById(targetId);
    if (el) {
      // Temporarily set tabindex to allow programmatic focus,
      // then remove it on blur so the element stays in the natural tab order
      const hadTabindex = el.hasAttribute('tabindex');
      if (!hadTabindex) {
        el.setAttribute('tabindex', '-1');
      }
      el.focus();
      if (!hadTabindex) {
        el.addEventListener(
          'blur',
          () => el.removeAttribute('tabindex'),
          { once: true },
        );
      }
    } else {
      window.location.hash = `#${targetId}`;
    }
  };

  return (
    <StyledSkipLink
      href={`#${targetId}`}
      className="a11y-skip-link"
      onClick={handleClick}
    >
      {children}
    </StyledSkipLink>
  );
};

export default SkipLink;
