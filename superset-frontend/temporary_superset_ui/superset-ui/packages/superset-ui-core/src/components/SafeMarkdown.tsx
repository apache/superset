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
          isValidNode: (node: MarkdownAbstractSyntaxTree) => node.type !== 'script',
        }),
      ]}
    />
  );
}

export default SafeMarkdown;
