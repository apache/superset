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
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';
import { merge } from 'lodash';
import { FeatureFlag, isFeatureEnabled } from '../utils';

interface SafeMarkdownProps {
  source: string;
}

function SafeMarkdown({ source }: SafeMarkdownProps) {
  const appContainer = document.getElementById('app');
  const { common } = JSON.parse(
    appContainer?.getAttribute('data-bootstrap') || '{}',
  );
  const htmlSanitization: boolean = common?.conf?.HTML_SANITIZATION ?? true;
  const htmlSchemaOverrides: typeof defaultSchema =
    common?.conf?.HTML_SANITIZATION_SCHEMA_EXTENSIONS || {};
  const displayHtml = isFeatureEnabled(FeatureFlag.DISPLAY_MARKDOWN_HTML);
  const escapeHtml = isFeatureEnabled(FeatureFlag.ESCAPE_MARKDOWN_HTML);

  const rehypePlugins = useMemo(() => {
    const rehypePlugins: any = [];
    if (displayHtml && !escapeHtml) {
      rehypePlugins.push(rehypeRaw);
      if (htmlSanitization) {
        const schema = merge(defaultSchema, htmlSchemaOverrides);
        rehypePlugins.push([rehypeSanitize, schema]);
      }
    }
    return rehypePlugins;
  }, [displayHtml, escapeHtml, htmlSanitization, htmlSchemaOverrides]);

  // React Markdown escapes HTML by default
  return (
    <ReactMarkdown rehypePlugins={rehypePlugins} skipHtml={!displayHtml}>
      {source}
    </ReactMarkdown>
  );
}

export default SafeMarkdown;
