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
import { styled, t } from '@superset-ui/core';
import { SyntaxHighlighterProps } from 'react-syntax-highlighter';
import sqlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import htmlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/htmlbars';
import markdownSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/markdown';
import jsonSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/json';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import Icons from 'src/components/Icons';
import { ToastProps } from 'src/components/MessageToasts/withToasts';
import copyTextToClipboard from 'src/utils/copy';

SyntaxHighlighter.registerLanguage('sql', sqlSyntax);
SyntaxHighlighter.registerLanguage('markdown', markdownSyntax);
SyntaxHighlighter.registerLanguage('html', htmlSyntax);
SyntaxHighlighter.registerLanguage('json', jsonSyntax);

const SyntaxHighlighterWrapper = styled.div`
  margin-top: -24px;

  &:hover {
    svg {
      visibility: visible;
    }
  }

  svg {
    position: relative;
    top: 40px;
    left: 512px;
    visibility: hidden;
    margin: -4px;
    color: ${({ theme }) => theme.colors.grayscale.base};
  }
`;

export default function SyntaxHighlighterCopy({
  addDangerToast,
  addSuccessToast,
  children,
  ...syntaxHighlighterProps
}: SyntaxHighlighterProps & {
  children: string;
  addDangerToast?: ToastProps['addDangerToast'];
  addSuccessToast?: ToastProps['addSuccessToast'];
  language: 'sql' | 'markdown' | 'html' | 'json';
}) {
  function copyToClipboard(textToCopy: string) {
    copyTextToClipboard(() => Promise.resolve(textToCopy))
      .then(() => {
        if (addSuccessToast) {
          addSuccessToast(t('SQL Copied!'));
        }
      })
      .catch(() => {
        if (addDangerToast) {
          addDangerToast(t('Sorry, your browser does not support copying.'));
        }
      });
  }
  return (
    <SyntaxHighlighterWrapper>
      <Icons.Copy
        tabIndex={0}
        role="button"
        onClick={e => {
          e.preventDefault();
          e.currentTarget.blur();
          copyToClipboard(children);
        }}
      />
      <SyntaxHighlighter style={github} {...syntaxHighlighterProps}>
        {children}
      </SyntaxHighlighter>
    </SyntaxHighlighterWrapper>
  );
}
