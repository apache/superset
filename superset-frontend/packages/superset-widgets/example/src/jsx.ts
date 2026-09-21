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

import { isValidElement, type ReactNode } from 'react';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const MAX_INLINE = 60;

function literal(value: unknown, indent: string): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'function') return '() => {…}';
  // Mutually recursive with elementToJsx: an element can hold props that are
  // themselves elements.
  // eslint-disable-next-line no-use-before-define
  if (isValidElement(value)) return elementToJsx(value);

  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    const items = value.map(item => literal(item, inner));
    const oneLine = `[${items.join(', ')}]`;
    if (oneLine.length <= MAX_INLINE && !oneLine.includes('\n')) return oneLine;
    return `[\n${items.map(item => `${inner}${item}`).join(',\n')},\n${indent}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .map(
      ([key, entry]) =>
        `${IDENTIFIER.test(key) ? key : `'${key}'`}: ${literal(entry, inner)}`,
    );
  if (entries.length === 0) return '{}';
  const oneLine = `{ ${entries.join(', ')} }`;
  if (oneLine.length <= MAX_INLINE && !oneLine.includes('\n')) return oneLine;
  return `{\n${entries.map(entry => `${inner}${entry}`).join(',\n')},\n${indent}}`;
}

function attribute(name: string, value: unknown, indent: string): string {
  if (value === true) return name;
  if (typeof value === 'string') return `${name}="${value}"`;
  return `${name}={${literal(value, indent)}}`;
}

function componentName(type: unknown): string {
  if (typeof type === 'string') return type;
  const component = type as { displayName?: string; name?: string };
  return component.displayName || component.name || 'Component';
}

/**
 * The JSX that produced a React element, rebuilt from its type and props
 * (children omitted). Showing this instead of hand-written snippets means the
 * code on the page can never drift from what actually rendered.
 */
export function elementToJsx(node: ReactNode): string {
  if (!isValidElement(node)) return '';
  const name = componentName(node.type);
  const props = Object.entries(node.props as Record<string, unknown>).filter(
    ([key, value]) => key !== 'children' && value !== undefined,
  );
  const inline = props.map(([key, value]) => attribute(key, value, ''));
  const oneLine = `<${name}${inline.length ? ` ${inline.join(' ')}` : ''} />`;
  if (oneLine.length <= 72 && !oneLine.includes('\n')) return oneLine;
  const lines = props.map(([key, value]) => `  ${attribute(key, value, '  ')}`);
  return `<${name}\n${lines.join('\n')}\n/>`;
}

/**
 * Everything needed to embed one widget on its own: the import, a provider,
 * and the widget's JSX rebuilt from the element that actually rendered.
 */
export function embedSnippet(node: ReactNode, supersetDomain: string): string {
  if (!isValidElement(node)) return '';
  const imports = [
    ...new Set([componentName(node.type), 'SupersetProvider']),
  ].sort();
  const body = elementToJsx(node)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
  return [
    `import { ${imports.join(', ')} } from '@apache-superset/widgets';`,
    '',
    `<SupersetProvider supersetDomain="${supersetDomain}">`,
    body,
    '</SupersetProvider>',
  ].join('\n');
}
