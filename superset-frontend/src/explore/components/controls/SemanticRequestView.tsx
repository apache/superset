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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import CodeSyntaxHighlighter, {
  SupportedLanguage,
} from '@superset-ui/core/components/CodeSyntaxHighlighter';
import { CopyToClipboard } from 'src/components';

export interface SemanticRequestViewProps {
  requestText: string;
}

export const REQUEST_KIND_LANGUAGES: ReadonlyMap<string, SupportedLanguage> =
  new Map([
    ['sql', 'sql'],
    ['json', 'json'],
  ]);

const RequestTextContainer = styled.div`
  max-height: ${({ theme }) => theme.sizeUnit * 80}px;
  overflow: auto;
`;

export default function SemanticRequestView({
  requestText,
}: SemanticRequestViewProps) {
  // Only inspect the first host-authored header; provider text stays opaque.
  const requestKind = /^-- ([^\r\n]*)/.exec(requestText)?.[1].toLowerCase();
  const highlightLanguage = REQUEST_KIND_LANGUAGES.get(requestKind ?? '');

  return (
    <div>
      <RequestTextContainer>
        {highlightLanguage ? (
          <CodeSyntaxHighlighter
            language={highlightLanguage}
            showCopyButton={false}
          >
            {requestText}
          </CodeSyntaxHighlighter>
        ) : (
          // An undefined highlighter language defaults to SQL, not plain text.
          <pre>{requestText}</pre>
        )}
      </RequestTextContainer>
      <CopyToClipboard
        text={requestText}
        shouldShowText={false}
        copyNode={<Button>{t('Copy')}</Button>}
      />
    </div>
  );
}
