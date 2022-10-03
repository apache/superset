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

import { TextStyle } from '../types';

const STYLE_FIELDS: (keyof TextStyle)[] = [
  'font',
  'fontWeight',
  'fontStyle',
  'fontSize',
  'fontFamily',
  'letterSpacing',
];

export default function updateTextNode(
  node: SVGTextElement,
  {
    className,
    style = {},
    text,
  }: {
    className?: string;
    style?: TextStyle;
    text?: string;
  } = {},
) {
  const textNode = node;

  if (textNode.textContent !== text) {
    textNode.textContent = typeof text === 'undefined' ? null : text;
  }
  if (textNode.getAttribute('class') !== className) {
    textNode.setAttribute('class', className ?? '');
  }

  // Clear style
  // Note: multi-word property names are hyphenated and not camel-cased.
  textNode.style.removeProperty('font');
  textNode.style.removeProperty('font-weight');
  textNode.style.removeProperty('font-style');
  textNode.style.removeProperty('font-size');
  textNode.style.removeProperty('font-family');
  textNode.style.removeProperty('letter-spacing');

  // Apply new style
  // Note: the font field will auto-populate other font fields when applicable.
  STYLE_FIELDS.filter(
    (field: keyof TextStyle) =>
      typeof style[field] !== 'undefined' && style[field] !== null,
  ).forEach((field: keyof TextStyle) => {
    textNode.style[field] = `${style[field]}`;
  });

  return textNode;
}
