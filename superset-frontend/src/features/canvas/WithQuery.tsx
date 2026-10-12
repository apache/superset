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
import { ReactNode, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { Button, Icons, Modal } from '@superset-ui/core/components';
import CodeSyntaxHighlighter, {
  SupportedLanguage,
} from '@superset-ui/core/components/CodeSyntaxHighlighter';
import { CopyToClipboard } from 'src/components';

const Frame = styled.div`
  position: relative;
  height: 100%;

  .canvas-view-query {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    opacity: 0;
  }

  &:hover .canvas-view-query,
  &:focus-within .canvas-view-query {
    opacity: 1;
  }
`;

const Footer = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.sizeUnit * 3}px;
  `}
`;

const LANGUAGES: SupportedLanguage[] = ['sql', 'htmlbars', 'markdown', 'json'];

export interface WithQueryProps {
  /** The query that produced the widget's data, when the user may see it. */
  query?: string;
  language?: string;
  children: ReactNode;
}

/**
 * A data widget with a "View query" action showing the query its data came
 * from, as the server ran it for this user: current filters and row level
 * security included.
 */
export default function WithQuery({
  query,
  language,
  children,
}: WithQueryProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  if (!query) return <>{children}</>;
  const highlight = LANGUAGES.find(supported => supported === language);
  return (
    <Frame>
      {children}
      <Button
        className="canvas-view-query"
        buttonStyle="link"
        buttonSize="small"
        aria-label={t('View query')}
        icon={<Icons.ConsoleSqlOutlined iconSize="m" />}
        onClick={() => setOpen(true)}
      />
      <Modal
        show={open}
        onHide={() => setOpen(false)}
        title={t('View query')}
        footer={null}
        responsive
      >
        {highlight ? (
          <CodeSyntaxHighlighter
            language={highlight}
            customStyle={{ fontSize: theme.fontSizeSM }}
          >
            {query}
          </CodeSyntaxHighlighter>
        ) : (
          <pre>{query}</pre>
        )}
        <Footer>
          <CopyToClipboard
            text={query}
            shouldShowText={false}
            copyNode={
              <Button
                buttonStyle="secondary"
                buttonSize="small"
                icon={<Icons.CopyOutlined />}
              >
                {t('Copy')}
              </Button>
            }
          />
        </Footer>
      </Modal>
    </Frame>
  );
}
