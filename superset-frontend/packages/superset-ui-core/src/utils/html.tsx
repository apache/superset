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
import { DataRecordValue } from '../types';

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
    table: ['width', 'border', 'align', 'valign', 'style'],
    tr: ['rowspan', 'align', 'valign', 'style'],
    td: ['width', 'rowspan', 'colspan', 'align', 'valign', 'style'],
    th: ['width', 'rowspan', 'colspan', 'align', 'valign', 'style'],
    tbody: ['align', 'valign', 'style'],
    thead: ['align', 'valign', 'style'],
    tfoot: ['align', 'valign', 'style'],
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

  // Check if the string contains common HTML patterns
  if (!hasHtmlTagPattern(text)) {
    return false;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanedStr, 'text/html');

  // Check if parsing created actual HTML elements (not just text nodes)
  const elements = Array.from(doc.body.childNodes).filter(
    node => node.nodeType === 1,
  ) as Element[];

  // If no elements were created, it's not HTML
  if (elements.length === 0) {
    return false;
  }

  // Check if the elements are known HTML tags (not custom/unknown tags)
  // This prevents strings like "<abcdef:12345>" from being treated as HTML
  return elements.some(element => {
    const tagName = element.tagName.toLowerCase();
    // List of common HTML tags we want to recognize
    const knownHtmlTags = [
      'div',
      'span',
      'p',
      'a',
      'b',
      'i',
      'u',
      'em',
      'strong',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'table',
      'tr',
      'td',
      'th',
      'tbody',
      'thead',
      'tfoot',
      'ul',
      'ol',
      'li',
      'img',
      'br',
      'hr',
      'pre',
      'code',
      'blockquote',
      'section',
      'article',
      'nav',
      'header',
      'footer',
      'form',
      'input',
      'button',
      'select',
      'option',
      'textarea',
      'label',
      'fieldset',
      'legend',
      'video',
      'audio',
      'canvas',
      'iframe',
      'script',
      'style',
      'link',
      'meta',
      'title',
    ];
    return knownHtmlTags.includes(tagName);
  });
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
  const doc = new DOMParser().parseFromString(str, 'text/html');
  const bodyText = doc.body?.textContent || '';
  const headText = doc.head?.textContent || '';
  return headText + bodyText;
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

export function extractTextFromHTML(value: DataRecordValue): DataRecordValue {
  if (typeof value === 'string' && isProbablyHTML(value)) {
    return removeHTMLTags(value);
  }
  return value;
}
