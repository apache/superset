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
import { cloneDeep, mergeWith } from 'lodash';
import { FeatureFlag, isFeatureEnabled } from '../../utils';

interface SafeMarkdownProps {
  source: string;
  htmlSanitization?: boolean;
  htmlSchemaOverrides?: typeof defaultSchema;
}

// Link protocols that can execute script when used as an href.
const DANGEROUS_LINK_PROTOCOLS = ['javascript', 'vbscript', 'data'];

/**
 * Sanitize link hrefs without using react-markdown's default protocol
 * allowlist, which would strip the custom link schemes that Superset markdown
 * is expected to support (see #26211). Instead of allowlisting known-safe
 * protocols, this blocks the protocols that enable script execution and leaves
 * everything else (http(s), mailto, relative URLs, anchors and custom schemes)
 * untouched. Applied regardless of the EscapeMarkdownHtml feature flag.
 */
export function transformLinkUri(uri: string): string {
  // Per the WHATWG URL parser, browsers strip leading C0 control
  // characters (\x00-\x1f) and space before resolving the scheme, so e.g.
  // "\x01javascript:alert(1)" executes on click. Strip them here too,
  // otherwise the blocklist check below could be bypassed with a leading
  // control character. The pattern is anchored at the start so it runs in
  // linear time; trailing whitespace does not affect the scheme and is
  // left for the renderer to handle.
  // eslint-disable-next-line no-control-regex
  const url = (uri || '').replace(/^[\u0000-\u0020]+/, '');
  const first = url.charAt(0);
  // Anchors and absolute/relative paths have no protocol.
  if (first === '#' || first === '/') {
    return url;
  }
  const colon = url.indexOf(':');
  if (colon === -1) {
    return url;
  }
  // A ':' after a '?' or '#' belongs to the query/fragment, not a scheme.
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1 && colon > queryIndex) {
    return url;
  }
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1 && colon > hashIndex) {
    return url;
  }
  // Whitespace and C0 control characters inside the scheme (e.g.
  // "java\tscript:" or "java\x01script:") are ignored by browsers, so strip
  // them before comparing against the blocklist.
  // eslint-disable-next-line no-control-regex
  const scheme = url
    .slice(0, colon)
    .replace(/[\u0000-\u0020]/g, '')
    .toLowerCase();
  return DANGEROUS_LINK_PROTOCOLS.includes(scheme) ? '' : url;
}

export function getOverrideHtmlSchema(
  originalSchema: typeof defaultSchema,
  htmlSchemaOverrides: SafeMarkdownProps['htmlSchemaOverrides'],
) {
  // Merge into a fresh clone: mergeWith mutates its first argument, and the
  // array customizer concatenates, so merging into the shared defaultSchema
  // import would progressively widen the sanitization allowlist for every
  // SafeMarkdown instance app-wide.
  return mergeWith(
    cloneDeep(originalSchema),
    htmlSchemaOverrides,
    (objValue, srcValue) =>
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
      transformLinkUri={transformLinkUri}
    >
      {source}
    </ReactMarkdown>
  );
}
