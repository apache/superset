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
import React from 'react';
import {
  sanitizeHtml,
  isProbablyHTML,
  sanitizeHtmlIfNeeded,
  safeHtmlSpan,
  removeHTMLTags,
} from './html';

describe('sanitizeHtml', () => {
  test('should sanitize the HTML string', () => {
    const htmlString = '<script>alert("XSS")</script>';
    const sanitizedString = sanitizeHtml(htmlString);
    expect(sanitizedString).not.toContain('script');
  });
});

describe('isProbablyHTML', () => {
  test('should return true if the text contains HTML tags', () => {
    const htmlText = '<div>Some HTML content</div>';
    const isHTML = isProbablyHTML(htmlText);
    expect(isHTML).toBe(true);
  });

  test('should return false if the text does not contain HTML tags', () => {
    const plainText = 'Just a plain text';
    const isHTML = isProbablyHTML(plainText);
    expect(isHTML).toBe(false);

    const trickyText = 'a <= 10 and b > 10';
    expect(isProbablyHTML(trickyText)).toBe(false);
  });
});

describe('sanitizeHtmlIfNeeded', () => {
  test('should sanitize the HTML string if it contains HTML tags', () => {
    const htmlString = '<div>Some <b>HTML</b> content</div>';
    const sanitizedString = sanitizeHtmlIfNeeded(htmlString);
    expect(sanitizedString).toEqual(htmlString);
  });

  test('should return the string as is if it does not contain HTML tags', () => {
    const plainText = 'Just a plain text';
    const sanitizedString = sanitizeHtmlIfNeeded(plainText);
    expect(sanitizedString).toEqual(plainText);
  });
});

describe('safeHtmlSpan', () => {
  test('should return a safe HTML span when the input is HTML', () => {
    const htmlString = '<div>Some <b>HTML</b> content</div>';
    const safeSpan = safeHtmlSpan(htmlString);
    expect(safeSpan).toEqual(
      <span
        className="safe-html-wrapper"
        dangerouslySetInnerHTML={{ __html: htmlString }}
      />,
    );
  });

  test('should return the input string as is when it is not HTML', () => {
    const plainText = 'Just a plain text';
    const result = safeHtmlSpan(plainText);
    expect(result).toEqual(plainText);
  });
});

describe('removeHTMLTags', () => {
  test('should remove HTML tags from the string', () => {
    const input = '<p>Hello, <strong>World!</strong></p>';
    const output = removeHTMLTags(input);
    expect(output).toBe('Hello, World!');
  });

  test('should return the same string when no HTML tags are present', () => {
    const input = 'This is a plain text.';
    const output = removeHTMLTags(input);
    expect(output).toBe('This is a plain text.');
  });

  test('should remove nested HTML tags and return combined text content', () => {
    const input = '<div><h1>Title</h1><p>Content</p></div>';
    const output = removeHTMLTags(input);
    expect(output).toBe('TitleContent');
  });

  test('should handle self-closing tags and return an empty string', () => {
    const input = '<img src="image.png" alt="Image">';
    const output = removeHTMLTags(input);
    expect(output).toBe('');
  });

  test('should handle malformed HTML tags and remove only well-formed tags', () => {
    const input = '<div><h1>Unclosed tag';
    const output = removeHTMLTags(input);
    expect(output).toBe('Unclosed tag');
  });
});
