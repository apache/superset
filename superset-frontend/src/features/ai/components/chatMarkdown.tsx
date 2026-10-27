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
 * @fileoverview Markdown rendering for chat messages.
 *
 * One place decides how an assistant answer looks, because the same components
 * also render the tool log: a SQL step and a SQL snippet in the answer get the
 * same highlighting, the same copy button and the same "Run in SQL Lab", which is
 * the point of routing the tool log through markdown at all.
 *
 * Fenced blocks are handled by overriding `pre`, not `code`. react-markdown 10
 * dropped the `inline` prop that told the two apart, and the remaining signals on
 * `code` are unreliable — a language-less fence has no className, and a
 * single-line fence has the same source positions as inline code. The distinction
 * survives in the tree, though: a fence is `pre > code` and inline code is a bare
 * `code`, so claiming `pre` gets block handling exactly and leaves `code` to
 * render inline spans untouched. The fence's text, language and info string are
 * read off the `code` child of the `pre` node, which `ExtraProps.node` supplies.
 */

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import type { Components } from 'react-markdown';
import type { Element, ElementContent } from 'hast';
import remarkGfm from 'remark-gfm';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import { addQueryEditor } from 'src/SqlLab/actions/sqlLab';
import type { QueryEditor, SqlLabRootState } from 'src/SqlLab/types';
import ChatChartEmbed, { parseChartEmbedParams } from './ChatChartEmbed';

export const REMARK_PLUGINS = [remarkGfm];

/** A SQL block longer than this collapses behind "Show more". */
const COLLAPSE_AFTER_LINES = 8;

const ChatTableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  margin: ${({ theme }) => theme.sizeUnit / 2}px 0;
  border-radius: ${({ theme }) => theme.borderRadius}px;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colorBgContainer};
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colorFillSecondary};
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.colorFillTertiary};
  }
`;

const ChatTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  background: ${({ theme }) => theme.colorBgContainer};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  overflow: hidden;
`;

const ChatTableHeader = styled.th`
  background: ${({ theme }) => theme.colorFillAlter};
  color: ${({ theme }) => theme.colorTextHeading};
  padding: ${({ theme }) => theme.sizeUnit}px
    ${({ theme }) => theme.sizeUnit * 2}px;
  text-align: left;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  border-bottom: 2px solid ${({ theme }) => theme.colorBorderSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  white-space: nowrap;
`;

const ChatTableCell = styled.td`
  padding: ${({ theme }) => theme.sizeUnit}px
    ${({ theme }) => theme.sizeUnit * 2}px;
  border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  color: ${({ theme }) => theme.colorText};
`;

const ChatTableRow = styled.tr`
  &:hover {
    background: ${({ theme }) => theme.colorBgTextHover};
  }

  &:last-child td {
    border-bottom: none;
  }
`;

const CodeBlockWrapper = styled.div`
  position: relative;

  .chat-code-action-button {
    opacity: 0;
    pointer-events: none;
  }

  &:hover .chat-code-action-button,
  .chat-code-action-button:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }
`;

const CodeBlockActions = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.sizeUnit}px;
  right: ${({ theme }) => theme.sizeUnit}px;
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit}px;
  z-index: 3;
`;

const CodeActionButton = styled.button`
  border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  background: ${({ theme }) => theme.colorBgContainer};
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  padding: 2px ${({ theme }) => theme.sizeUnit}px;
  line-height: 1.4;
  cursor: pointer;
  transition: opacity ${({ theme }) => theme.motionDurationFast};

  &:hover {
    color: ${({ theme }) => theme.colorPrimary};
    border-color: ${({ theme }) => theme.colorPrimary};
  }
`;

const SqlKeyword = styled.span`
  color: ${({ theme }) => theme.colorPrimary};
  font-weight: ${({ theme }) => theme.fontWeightStrong};
`;

const SqlString = styled.span`
  color: ${({ theme }) => theme.colorWarningText};
`;

const SqlComment = styled.span`
  color: ${({ theme }) => theme.colorTextTertiary};
  font-style: italic;
`;

const CollapsibleCodeContainer = styled.div<{
  collapsed: boolean;
  isCollapsible: boolean;
}>`
  position: relative;
  ${({ collapsed, isCollapsible }) =>
    collapsed &&
    isCollapsible &&
    css`
      max-height: calc(1.5em * ${COLLAPSE_AFTER_LINES} + 24px);
      overflow: hidden;
    `}
`;

const CodeFadeOverlay = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${({ theme }) => theme.sizeUnit * 14}px;
  background: linear-gradient(
    to bottom,
    transparent,
    ${({ theme }) => theme.colorBgContainer}
  );
  pointer-events: none;
`;

const ExpandCodeButton = styled.button<{ floating?: boolean }>`
  position: ${({ floating }) => (floating ? 'absolute' : 'relative')};
  left: ${({ floating }) => (floating ? '50%' : '0')};
  bottom: ${({ floating, theme }) =>
    floating ? `${theme.sizeUnit}px` : 'auto'};
  transform: ${({ floating }) => (floating ? 'translateX(-50%)' : 'none')};
  border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  border-radius: 999px;
  background: ${({ theme }) => theme.colorBgContainer};
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  padding: 2px ${({ theme }) => theme.sizeUnit * 2}px;
  line-height: 1.4;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit / 2}px;
  margin: ${({ floating, theme }) =>
    floating ? '0' : `${theme.sizeUnit / 2}px auto 0`};

  &:hover {
    color: ${({ theme }) => theme.colorPrimary};
    border-color: ${({ theme }) => theme.colorPrimary};
  }
`;

const SQL_TOKEN_PATTERN =
  /(--.*$|'(?:''|[^'])*'|\b(?:SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|FULL|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|AS|AND|OR|NOT|IN|IS|NULL|CASE|WHEN|THEN|ELSE|END|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CAST|DATE_TRUNC|WITH|UNION|ALL|DESC|ASC)\b)/gim;

/**
 * Highlights SQL without a syntax-highlighting dependency.
 *
 * Comments and string literals are matched before keywords so a keyword inside
 * either is not coloured as code.
 */
export const renderSqlHighlightedCode = (sqlText: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;
  let match: RegExpExecArray | null;
  SQL_TOKEN_PATTERN.lastIndex = 0;

  // eslint-disable-next-line no-cond-assign
  while ((match = SQL_TOKEN_PATTERN.exec(sqlText)) !== null) {
    const [token] = match;
    const tokenStart = match.index;

    if (tokenStart > lastIndex) {
      nodes.push(sqlText.slice(lastIndex, tokenStart));
    }

    if (token.startsWith('--')) {
      nodes.push(
        <SqlComment key={`sql-token-${matchIndex}`}>{token}</SqlComment>,
      );
    } else if (token.startsWith("'")) {
      nodes.push(
        <SqlString key={`sql-token-${matchIndex}`}>{token}</SqlString>,
      );
    } else {
      nodes.push(
        <SqlKeyword key={`sql-token-${matchIndex}`}>{token}</SqlKeyword>,
      );
    }

    lastIndex = tokenStart + token.length;
    matchIndex += 1;
  }

  if (lastIndex < sqlText.length) {
    nodes.push(sqlText.slice(lastIndex));
  }

  return nodes;
};

interface MarkdownCodeBlockProps {
  className?: string;
  codeText: string;
  isSqlBlock: boolean;
  isExpanded: boolean;
  /**
   * The database to run against, already resolved from the fence's info string or
   * the deployment default. Undefined means the action is not offered at all.
   */
  dbId?: number;
  onCopy: (content: string) => Promise<void>;
  onRunInSqlLab: (sql: string, dbId?: number) => void;
  onToggleExpanded: (expanded: boolean) => void;
}

const MarkdownCodeBlock = ({
  className,
  codeText,
  isSqlBlock,
  isExpanded,
  dbId,
  onCopy,
  onRunInSqlLab,
  onToggleExpanded,
}: MarkdownCodeBlockProps) => {
  const lineCount = codeText.split('\n').length;
  const isCollapsible = isSqlBlock && lineCount > COLLAPSE_AFTER_LINES;
  const showCollapsedView = isCollapsible && !isExpanded;

  return (
    <CodeBlockWrapper>
      <CodeBlockActions>
        <Tooltip title={t('Copy code')}>
          <CodeActionButton
            type="button"
            className="chat-code-action-button"
            onClick={event => {
              event.stopPropagation();
              onCopy(codeText).catch(() => {
                // As with the transcript's copy action: a refused clipboard is
                // not worth surfacing.
              });
            }}
            aria-label={t('Copy code block')}
          >
            <Icons.CopyOutlined iconSize="s" />
          </CodeActionButton>
        </Tooltip>
        {isSqlBlock && dbId !== undefined && (
          <Tooltip title={t('Run in SQL Lab')}>
            <CodeActionButton
              type="button"
              className="chat-code-action-button"
              onClick={event => {
                event.stopPropagation();
                onRunInSqlLab(codeText, dbId);
              }}
              aria-label={t('Run in SQL Lab')}
            >
              <Icons.PlayCircleOutlined iconSize="s" />
            </CodeActionButton>
          </Tooltip>
        )}
      </CodeBlockActions>
      <CollapsibleCodeContainer
        collapsed={showCollapsedView}
        isCollapsible={isCollapsible}
      >
        <pre>
          <code className={className}>
            {isSqlBlock ? renderSqlHighlightedCode(codeText) : codeText}
          </code>
        </pre>
        {showCollapsedView && (
          <>
            <CodeFadeOverlay />
            <ExpandCodeButton
              floating
              type="button"
              onClick={event => {
                event.stopPropagation();
                onToggleExpanded(true);
              }}
              aria-label={t('Expand SQL code block')}
            >
              <Icons.DownOutlined iconSize="s" />
              {t('Show more')}
            </ExpandCodeButton>
          </>
        )}
        {isCollapsible && isExpanded && (
          <ExpandCodeButton
            type="button"
            onClick={event => {
              event.stopPropagation();
              onToggleExpanded(false);
            }}
            aria-label={t('Collapse SQL code block')}
          >
            <Icons.UpOutlined iconSize="s" />
            {t('Show less')}
          </ExpandCodeButton>
        )}
      </CollapsibleCodeContainer>
    </CodeBlockWrapper>
  );
};

/** The `code` element of a fenced block, or undefined for anything else. */
const fencedCodeChild = (node: Element | undefined): Element | undefined => {
  const child = node?.children?.find(
    (candidate: ElementContent): candidate is Element =>
      candidate.type === 'element' && candidate.tagName === 'code',
  );
  return child;
};

/** All text under a hast node, which for a fence is the block's source. */
const collectText = (node: ElementContent | Element): string => {
  if (node.type === 'text') {
    return node.value;
  }
  if (node.type === 'element') {
    return node.children.map(collectText).join('');
  }
  return '';
};

const classNamesOf = (node: Element | undefined): string => {
  const value = node?.properties?.className;
  if (Array.isArray(value)) {
    return value.filter(entry => typeof entry === 'string').join(' ');
  }
  return typeof value === 'string' ? value : '';
};

/**
 * The info string after the language, which the SQL tool uses to name the
 * database a statement should be run against (```sql 3).
 */
const metaDbIdOf = (node: Element | undefined): number | undefined => {
  const meta = node?.data?.meta;
  if (typeof meta !== 'string') {
    return undefined;
  }
  const parsed = parseInt(meta, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export interface UseChatMarkdownReturn {
  /** Per-message SQL block expansion state; pass to memoized rows for invalidation. */
  expandedSqlBlocksByMessage: Record<string, boolean[]>;
  /** Copy helper (also used by message-level copy buttons). */
  copyToClipboard: (content: string) => Promise<void>;
  /** Factory returning react-markdown component overrides for a given message. */
  createMarkdownComponents: (messageId: string) => Components;
}

/**
 * The markdown component overrides plus the copy and run-in-SQL-Lab behaviours.
 *
 * The factory is per message because SQL blocks are counted within a message to
 * key their expansion state, and that counter has to restart for each one.
 */
export const useChatMarkdown = (): UseChatMarkdownReturn => {
  const dispatch = useDispatch();
  const history = useHistory();
  const location = useLocation();

  const [expandedSqlBlocksByMessage, setExpandedSqlBlocksByMessage] = useState<
    Record<string, boolean[]>
  >({});

  const sqlLabContext = useSelector((state: Partial<SqlLabRootState>) => ({
    queryEditors: state.sqlLab?.queryEditors || [],
    tabHistory: state.sqlLab?.tabHistory || [],
    unsavedQueryEditor: state.sqlLab?.unsavedQueryEditor || {},
    defaultDbId: state.common?.conf?.SQLLAB_DEFAULT_DBID as number | undefined,
    defaultQueryLimit: state.common?.conf?.DEFAULT_SQLLAB_LIMIT as
      | number
      | undefined,
  }));

  const copyToClipboard = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        dispatch(addSuccessToast(t('Copied to clipboard')));
      } catch {
        dispatch(
          addDangerToast(t('Sorry, your browser does not support copying.')),
        );
      }
    },
    [dispatch],
  );

  const runInSqlLab = useCallback(
    (sql: string, dbId?: number) => {
      const trimmedSql = sql.trim();
      if (!trimmedSql) {
        return;
      }

      // No deployment-specific fallback: a block whose database cannot be
      // resolved does not offer the action at all, rather than opening an editor
      // pointed at whichever database happens to be first.
      const resolvedDbId = dbId ?? sqlLabContext.defaultDbId;
      if (resolvedDbId === undefined) {
        return;
      }

      // Post-route_base path only; see the note in usePageContext.
      const isSqlLabRoute = location.pathname.includes('/sqllab');

      if (isSqlLabRoute) {
        const activeEditorId =
          sqlLabContext.tabHistory[sqlLabContext.tabHistory.length - 1];
        const activeEditor = sqlLabContext.queryEditors.find(
          (queryEditor: QueryEditor) => queryEditor.id === activeEditorId,
        );
        const mergedEditor =
          activeEditor &&
          sqlLabContext.unsavedQueryEditor?.id === activeEditor.id
            ? { ...activeEditor, ...sqlLabContext.unsavedQueryEditor }
            : activeEditor;

        dispatch(
          addQueryEditor({
            name: t('Chat Query'),
            dbId: resolvedDbId,
            catalog: mergedEditor?.catalog ?? null,
            schema: mergedEditor?.schema,
            autorun: false,
            sql: trimmedSql,
            queryLimit:
              mergedEditor?.queryLimit ?? sqlLabContext.defaultQueryLimit,
            templateParams: mergedEditor?.templateParams,
          }),
        );
        return;
      }

      history.push({
        pathname: '/sqllab',
        state: {
          requestedQuery: {
            sql: trimmedSql,
            dbid: String(resolvedDbId),
            name: t('Chat Query'),
          },
        },
      });
    },
    [dispatch, history, location.pathname, sqlLabContext],
  );

  const isSqlBlockExpanded = useCallback(
    (messageId: string, sqlBlockIndex: number): boolean =>
      expandedSqlBlocksByMessage[messageId]?.[sqlBlockIndex] === true,
    [expandedSqlBlocksByMessage],
  );

  const setSqlBlockExpanded = useCallback(
    (messageId: string, sqlBlockIndex: number, expanded: boolean) => {
      setExpandedSqlBlocksByMessage(previous => {
        const currentArray = [...(previous[messageId] ?? [])];
        currentArray[sqlBlockIndex] = expanded;
        return { ...previous, [messageId]: currentArray };
      });
    },
    [],
  );

  const createMarkdownComponents = useCallback(
    (messageId: string): Components => {
      let sqlBlockCounter = 0;
      return {
        // Fenced blocks only. Inline code falls through to the default `code`
        // renderer and is styled by the message bubble's own rules.
        pre({ node, children }) {
          const codeNode = fencedCodeChild(node);
          if (!codeNode) {
            return <pre>{children}</pre>;
          }

          const className = classNamesOf(codeNode);
          const codeText = collectText(codeNode).replace(/\n$/, '');

          if (/language-superset-chart\b/i.test(className)) {
            const params = parseChartEmbedParams(codeText);
            if (params.formDataKey) {
              return (
                <ChatChartEmbed
                  formDataKey={params.formDataKey}
                  height={params.height}
                  title={params.title ?? undefined}
                />
              );
            }
            // A malformed embed keeps its source visible rather than vanishing.
            return <pre>{children}</pre>;
          }

          const isSqlBlock = /language-sql\b/i.test(className);
          const sqlBlockIndex = isSqlBlock ? sqlBlockCounter : -1;
          if (isSqlBlock) {
            sqlBlockCounter += 1;
          }

          return (
            <MarkdownCodeBlock
              className={className || undefined}
              codeText={codeText}
              isSqlBlock={isSqlBlock}
              isExpanded={
                isSqlBlock
                  ? isSqlBlockExpanded(messageId, sqlBlockIndex)
                  : false
              }
              // The fence may name its own database; otherwise the deployment
              // default is used, and if there is neither the action is hidden.
              dbId={
                isSqlBlock
                  ? (metaDbIdOf(codeNode) ?? sqlLabContext.defaultDbId)
                  : undefined
              }
              onCopy={copyToClipboard}
              onRunInSqlLab={runInSqlLab}
              onToggleExpanded={expanded => {
                if (isSqlBlock) {
                  setSqlBlockExpanded(messageId, sqlBlockIndex, expanded);
                }
              }}
            />
          );
        },
        table({ children }) {
          return (
            <ChatTableContainer>
              <ChatTable>{children}</ChatTable>
            </ChatTableContainer>
          );
        },
        tr({ children }) {
          return <ChatTableRow>{children}</ChatTableRow>;
        },
        th({ children }) {
          return <ChatTableHeader>{children}</ChatTableHeader>;
        },
        td({ children }) {
          return <ChatTableCell>{children}</ChatTableCell>;
        },
      };
    },
    [
      copyToClipboard,
      isSqlBlockExpanded,
      runInSqlLab,
      setSqlBlockExpanded,
      sqlLabContext.defaultDbId,
    ],
  );

  return {
    expandedSqlBlocksByMessage,
    copyToClipboard,
    createMarkdownComponents,
  };
};
