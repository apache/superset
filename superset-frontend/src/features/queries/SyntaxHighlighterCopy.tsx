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
import { useEffect } from 'react';
import { styled, t } from '@superset-ui/core';
import CodeSyntaxHighlighter, {
  SupportedLanguage,
  CodeSyntaxHighlighterProps,
  preloadLanguages,
} from '@superset-ui/core/components/CodeSyntaxHighlighter';
import { Icons } from '@superset-ui/core/components/Icons';
import { ToastProps } from 'src/components/MessageToasts/withToasts';
import copyTextToClipboard from 'src/utils/copy';

const SyntaxHighlighterWrapper = styled.div`
  position: relative;

  &:hover {
    .copy-button {
      visibility: visible;
    }
  }

  .copy-button {
    position: absolute;
    top: 40px;
    right: 16px;
    z-index: 10;
    visibility: hidden;
    margin: -4px;
    padding: 4px;
    background: ${({ theme }) => theme.colorBgContainer};
    border-radius: ${({ theme }) => theme.borderRadius}px;
    color: ${({ theme }) => theme.colorIcon};
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: ${({ theme }) => theme.colorFillContentHover};
      color: ${({ theme }) => theme.colorIconHover};
    }

    &:focus {
      visibility: visible;
      outline: 2px solid ${({ theme }) => theme.colorPrimary};
      outline-offset: 2px;
    }
  }
`;

interface SyntaxHighlighterCopyProps
  extends Omit<CodeSyntaxHighlighterProps, 'children'> {
  children: string;
  addDangerToast?: ToastProps['addDangerToast'];
  addSuccessToast?: ToastProps['addSuccessToast'];
  language: SupportedLanguage;
}

export default function SyntaxHighlighterCopy({
  addDangerToast,
  addSuccessToast,
  children,
  language,
  ...syntaxHighlighterProps
}: SyntaxHighlighterCopyProps) {
  // Preload the language when component mounts
  useEffect(() => {
    preloadLanguages([language]);
  }, [language]);

  function copyToClipboard(textToCopy: string) {
    copyTextToClipboard(() => Promise.resolve(textToCopy))
      .then(() => {
        if (addSuccessToast) {
          addSuccessToast(t('Code Copied!'));
        }
      })
      .catch(() => {
        if (addDangerToast) {
          addDangerToast(t('Sorry, your browser does not support copying.'));
        }
      });
  }

  const handleCopyClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.blur();
    copyToClipboard(children);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      copyToClipboard(children);
    }
  };

  return (
    <SyntaxHighlighterWrapper>
      <Icons.CopyOutlined
        className="copy-button"
        tabIndex={0}
        role="button"
        aria-label={t('Copy code to clipboard')}
        onClick={handleCopyClick}
        onKeyDown={handleKeyDown}
      />
      <CodeSyntaxHighlighter language={language} {...syntaxHighlighterProps}>
        {children}
      </CodeSyntaxHighlighter>
    </SyntaxHighlighterWrapper>
  );
}
