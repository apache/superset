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
import { useEffect, useMemo, useState } from 'react';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
// TODO: Upgrade to remark-gfm v4+ after migrating to React 18.
// remark-gfm v4+ requires react-markdown v9+, which requires React 18.
// Currently pinned to v3.0.1 for compatibility with react-markdown v8 and React 17.
import remarkGfm from 'remark-gfm';
import { mergeWith } from 'lodash';
import { FeatureFlag, isFeatureEnabled } from '../../utils';

// Reject link protocols that can execute script; allow everything else
// (including the custom schemes supported since #26211).
// ASCII control chars (e.g. \n, \t) embedded inside a scheme name evade naive
// protocol regexes — strip them before testing so "java\nscript:" is caught.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const DANGEROUS_LINK_PROTOCOL = /^\s*(?:javascript|vbscript|data):/i;

export function transformMarkdownLinkUri(uri: string): string {
  if (typeof uri !== 'string') {
    return '';
  }
  const normalized = uri.replace(CONTROL_CHARS, '');
  return DANGEROUS_LINK_PROTOCOL.test(normalized) ? '' : uri;
}

interface SafeMarkdownProps {
  source: string;
  htmlSanitization?: boolean;
  htmlSchemaOverrides?: typeof defaultSchema;
}

export function getOverrideHtmlSchema(
  originalSchema: typeof defaultSchema,
  htmlSchemaOverrides: SafeMarkdownProps['htmlSchemaOverrides'],
) {
  return mergeWith(originalSchema, htmlSchemaOverrides, (objValue, srcValue) =>
    Array.isArray(objValue) ? objValue.concat(srcValue) : undefined,
  );
}

export function SafeMarkdown({
  source,
  htmlSanitization = true,
  htmlSchemaOverrides = {},
}: SafeMarkdownProps) {
  const escapeHtml = isFeatureEnabled(FeatureFlag.EscapeMarkdownHtml);
  const [rehypeRawPlugin, setRehypeRawPlugin] = useState<any>(null);
  const [ReactMarkdown, setReactMarkdown] = useState<any>(null);
  useEffect(() => {
    Promise.all([import('rehype-raw'), import('react-markdown')]).then(
      ([rehypeRaw, ReactMarkdown]) => {
        setRehypeRawPlugin(() => rehypeRaw.default);
        setReactMarkdown(() => ReactMarkdown.default);
      },
    );
  }, []);

  const rehypePlugins = useMemo(() => {
    const rehypePlugins: any = [];
    if (!escapeHtml && rehypeRawPlugin) {
      rehypePlugins.push(rehypeRawPlugin);
      if (htmlSanitization) {
        const schema = getOverrideHtmlSchema(
          defaultSchema,
          htmlSchemaOverrides,
        );
        rehypePlugins.push([rehypeSanitize, schema]);
      }
    }
    return rehypePlugins;
  }, [escapeHtml, htmlSanitization, htmlSchemaOverrides, rehypeRawPlugin]);

  if (!ReactMarkdown || !rehypeRawPlugin) {
    return null;
  }

  // React Markdown escapes HTML by default
  return (
    <ReactMarkdown
      rehypePlugins={rehypePlugins}
      remarkPlugins={[remarkGfm]}
      skipHtml={false}
      transformLinkUri={transformMarkdownLinkUri}
    >
      {source}
    </ReactMarkdown>
  );
}
