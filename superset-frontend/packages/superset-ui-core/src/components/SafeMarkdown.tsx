/*
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

import React from 'react';
import ReactMarkdown, { MarkdownAbstractSyntaxTree } from 'react-markdown';
// @ts-ignore no types available
import htmlParser from 'react-markdown/plugins/html-parser';

import { FeatureFlag, isFeatureEnabled } from '../utils';

interface SafeMarkdownProps {
  source: string;
}

function isSafeMarkup(node: MarkdownAbstractSyntaxTree) {
  return node.type === 'html' && node.value
    ? /href="(javascript|vbscript|file):.*"/gim.test(node.value) === false
    : true;
}

function SafeMarkdown({ source }: SafeMarkdownProps) {
  return (
    <ReactMarkdown
      source={source}
      escapeHtml={isFeatureEnabled(FeatureFlag.ESCAPE_MARKDOWN_HTML)}
      skipHtml={!isFeatureEnabled(FeatureFlag.DISPLAY_MARKDOWN_HTML)}
      allowNode={isSafeMarkup}
      astPlugins={[
        htmlParser({
          isValidNode: (node: MarkdownAbstractSyntaxTree) =>
            node.type !== 'script',
        }),
      ]}
    />
  );
}

export default SafeMarkdown;
