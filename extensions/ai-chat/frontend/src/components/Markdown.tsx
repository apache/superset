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
/**
 * Minimal safe Markdown renderer, used because the host's SafeMarkdown is
 * unreachable from extensions: @superset-ui/core is not federation-shared.
 *
 * Emits React elements only, with no dangerouslySetInnerHTML and no raw HTML
 * pass-through, so model output cannot inject markup or scripts. Link URLs
 * are restricted to relative paths, fragments, http(s) and mailto, and
 * anything else renders as plain text. Headings, paragraphs, fenced code
 * blocks, lists, blockquotes, inline code, bold, italic and links are
 * supported; other syntax degrades to plain text.
 */
import React, { ReactNode } from 'react';
import { theme } from '@apache-superset/core';

const { useTheme } = theme;

// Strip control characters and whitespace before the scheme checks, which
// defeats obfuscation such as "java\tscript:"
function sanitizeHref(raw: string): string | null {
  const cleaned = raw.replace(/[\u0000-\u0020\u007f]/g, '');
  if (
    cleaned.startsWith('/') ||
    cleaned.startsWith('#') ||
    /^https?:\/\//i.test(cleaned) ||
    /^mailto:/i.test(cleaned)
  ) {
    return cleaned;
  }
  return null;
}

const INLINE_PATTERN =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  // A fresh regex per call, since this function recurses and sharing a global
  // regex across recursion levels corrupts lastIndex and never terminates
  const pattern = new RegExp(INLINE_PATTERN.source, 'g');
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const nodeKey = `${keyPrefix}-${key}`;
    key += 1;
    if (token.startsWith('`')) {
      nodes.push(<code key={nodeKey}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={nodeKey}>
          {renderInline(token.slice(2, -2), nodeKey)}
        </strong>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={nodeKey}>{renderInline(token.slice(1, -1), nodeKey)}</em>,
      );
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const href = linkMatch ? sanitizeHref(linkMatch[2]) : null;
      if (linkMatch && href) {
        nodes.push(
          <a key={nodeKey} href={href} rel="noopener noreferrer">
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

interface Block {
  kind: 'heading' | 'paragraph' | 'code' | 'ul' | 'ol' | 'quote';
  level?: number;
  lines: string[];
}

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === '') {
      index += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1; // closing fence
      blocks.push({ kind: 'code', lines: code });
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        lines: [heading[2]],
      });
      index += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const list: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        list.push(lines[index].replace(/^\s*[-*]\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'ul', lines: list });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const list: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        list.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'ol', lines: list });
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith('>')) {
        quote.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ kind: 'quote', lines: quote });
      continue;
    }
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !lines[index].startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !lines[index].startsWith('>')
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ kind: 'paragraph', lines: paragraph });
  }
  return blocks;
}

export default function Markdown({ source }: { source: string }) {
  const theme = useTheme();
  const blocks = parseBlocks(source);
  // Markdown has no antd counterpart, so these block elements are styled
  // directly, from theme tokens rather than literals
  const codeStyle: React.CSSProperties = {
    overflowX: 'auto',
    padding: theme.paddingXS,
    borderRadius: theme.borderRadiusSM,
    background: theme.colorFillTertiary,
    fontSize: theme.fontSizeSM,
    whiteSpace: 'pre',
  };
  const blockSpacing = `${theme.marginXXS}px 0`;
  const listStyle: React.CSSProperties = {
    paddingLeft: theme.paddingLG,
    margin: blockSpacing,
  };
  return (
    <>
      {blocks.map((block, blockIndex) => {
        const key = `block-${blockIndex}`;
        switch (block.kind) {
          case 'code':
            return (
              <pre key={key} style={codeStyle}>
                <code>{block.lines.join('\n')}</code>
              </pre>
            );
          case 'heading': {
            const Tag = `h${Math.min(
              6,
              (block.level || 1) + 2,
            )}` as keyof JSX.IntrinsicElements;
            return <Tag key={key}>{renderInline(block.lines[0], key)}</Tag>;
          }
          case 'ul':
            return (
              <ul key={key} style={listStyle}>
                {block.lines.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>
                    {renderInline(item, `${key}-${itemIndex}`)}
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} style={listStyle}>
                {block.lines.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>
                    {renderInline(item, `${key}-${itemIndex}`)}
                  </li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote
                key={key}
                style={{
                  borderLeft: `3px solid ${theme.colorBorder}`,
                  margin: blockSpacing,
                  paddingLeft: theme.paddingXS,
                }}
              >
                {renderInline(block.lines.join(' '), key)}
              </blockquote>
            );
          default:
            return (
              <p key={key} style={{ margin: blockSpacing }}>
                {renderInline(block.lines.join(' '), key)}
              </p>
            );
        }
      })}
    </>
  );
}
