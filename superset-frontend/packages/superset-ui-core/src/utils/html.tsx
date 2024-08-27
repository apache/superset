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
import { FilterXSS, getDefaultWhiteList } from 'xss';

const xssFilter = new FilterXSS({
  whiteList: {
    ...getDefaultWhiteList(),
    span: ['style', 'class', 'title'],
    div: ['style', 'class'],
    a: ['style', 'class', 'href', 'title', 'target'],
    img: ['style', 'class', 'src', 'alt', 'title', 'width', 'height'],
    video: [
      'autoplay',
      'controls',
      'loop',
      'preload',
      'src',
      'height',
      'width',
      'muted',
    ],
  },
  stripIgnoreTag: true,
  css: false,
});

export function sanitizeHtml(htmlString: string) {
  return xssFilter.process(htmlString);
}

export function hasHtmlTagPattern(str: string): boolean {
  const htmlTagPattern =
    /<(html|head|body|div|span|a|p|h[1-6]|title|meta|link|script|style)/i;

  return htmlTagPattern.test(str);
}

export function isProbablyHTML(text: string) {
  const cleanedStr = text.trim().toLowerCase();

  if (
    cleanedStr.startsWith('<!doctype html>') &&
    hasHtmlTagPattern(cleanedStr)
  ) {
    return true;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanedStr, 'text/html');
  return Array.from(doc.body.childNodes).some(({ nodeType }) => nodeType === 1);
}

export function sanitizeHtmlIfNeeded(htmlString: string) {
  return isProbablyHTML(htmlString) ? sanitizeHtml(htmlString) : htmlString;
}

export function safeHtmlSpan(possiblyHtmlString: string) {
  const isHtml = isProbablyHTML(possiblyHtmlString);
  if (isHtml) {
    return (
      <span
        className="safe-html-wrapper"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(possiblyHtmlString) }}
      />
    );
  }
  return possiblyHtmlString;
}

export function removeHTMLTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

export function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

export function getParagraphContents(
  str: string,
): { [key: string]: string } | null {
  if (!isProbablyHTML(str)) {
    return null;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(str, 'text/html');
  const pTags = doc.querySelectorAll('p');

  if (pTags.length === 0) {
    return null;
  }

  const paragraphContents: { [key: string]: string } = {};

  pTags.forEach((pTag, index) => {
    paragraphContents[`p${index + 1}`] = pTag.textContent || '';
  });

  return paragraphContents;
}
