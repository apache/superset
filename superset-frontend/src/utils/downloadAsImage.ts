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
import { SyntheticEvent } from 'react';
import domToImage from 'dom-to-image-more';
import { kebabCase } from 'lodash';
// eslint-disable-next-line no-restricted-imports
import { SupersetTheme, t } from '@superset-ui/core';
import { addWarningToast } from 'src/components/MessageToasts/actions';

const IMAGE_DOWNLOAD_QUALITY = 0.95;

/**
 * generate a consistent file stem from a description and date
 *
 * @param description title or description of content of file
 * @param date date when file was generated
 */
const generateFileStem = (description: string, date = new Date()) =>
  `${kebabCase(description)}-${date.toISOString().replace(/[: ]/g, '-')}`;

const CRITICAL_STYLE_PROPERTIES = new Set([
  'display',
  'position',
  'width',
  'height',
  'max-width',
  'max-height',
  'margin',
  'padding',
  'top',
  'right',
  'bottom',
  'left',
  'font',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-decoration',
  'color',
  'background-color',
  'border',
  'border-width',
  'border-style',
  'border-color',
  'opacity',
  'visibility',
  'overflow',
  'z-index',
  'transform',
  'flex',
  'flex-direction',
  'justify-content',
  'align-items',
  'grid',
  'grid-template',
  'grid-area',
  'table-layout',
  'vertical-align',
  'text-align',
]);

const styleCache = new WeakMap<Element, CSSStyleDeclaration>();

const copyAllComputedStyles = (original: Element, clone: Element) => {
  const queue: Array<[Element, Element]> = [[original, clone]];
  const processed = new WeakSet<Element>();

  while (queue.length) {
    const [origNode, cloneNode] = queue.shift()!;
    if (processed.has(origNode)) continue;
    processed.add(origNode);

    let computed = styleCache.get(origNode);
    if (!computed) {
      computed = window.getComputedStyle(origNode);
      styleCache.set(origNode, computed);
    }

    for (const property of CRITICAL_STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (value && value !== 'initial' && value !== 'inherit') {
        (cloneNode as HTMLElement).style.setProperty(
          property,
          value,
          computed.getPropertyPriority(property),
        );
      }
    }

    if (origNode.textContent?.trim()) {
      const { color } = computed;
      if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
        (cloneNode as HTMLElement).style.color = '#000';
      }
      (cloneNode as HTMLElement).style.visibility = 'visible';
      if (computed.display === 'none') {
        (cloneNode as HTMLElement).style.display = 'block';
      }
    }

    for (let i = 0; i < origNode.children.length; i += 1) {
      queue.push([origNode.children[i], cloneNode.children[i]]);
    }
  }
};

const processCloneForVisibility = (clone: HTMLElement) => {
  const cloneStyle = clone.style;
  cloneStyle.height = 'auto';
  cloneStyle.maxHeight = 'none';

  const scrollableSelectors = [
    '[style*="overflow"]',
    '.scrollable',
    '.table-responsive',
    '.ant-table-body',
    '.table-container',
    '.ant-table-container',
    '.table-wrapper',
    '.ant-table-tbody',
    'tbody',
    '.table-body',
    '.virtual-table',
    '.react-window',
    '.react-virtualized',
  ];

  scrollableSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => {
      const element = el as HTMLElement;
      element.style.overflow = 'visible';
      element.style.height = 'auto';
      element.style.maxHeight = 'none';
    });
  });

  clone
    .querySelectorAll('table, .ant-table, .table-container, .data-table')
    .forEach(table => {
      const el = table as HTMLElement;
      el.style.margin = '0 auto';
      el.style.display = 'table';
      el.style.width = '100%';
      el.style.tableLayout = 'auto';
    });

  clone
    .querySelectorAll('tr, .ant-table-row, .table-row, .data-row')
    .forEach(row => {
      const el = row as HTMLElement;
      el.style.display = 'table-row';
      el.style.visibility = 'visible';
      el.style.height = 'auto';
    });

  clone
    .querySelectorAll('td, th, .ant-table-cell, .table-cell')
    .forEach(cell => {
      const el = cell as HTMLElement;
      el.style.display = 'table-cell';
      el.style.visibility = 'visible';
    });

  clone.querySelectorAll('*').forEach(el => {
    const element = el as HTMLElement;
    if (element.textContent?.trim()) {
      const computed = window.getComputedStyle(element);
      if (computed.color === 'transparent') {
        element.style.color = '#000';
      }
      element.style.visibility = 'visible';
      if (computed.display === 'none') {
        element.style.display = 'block';
      }
    }
  });

  clone
    .querySelectorAll('[data-virtualized], .virtualized, .lazy-load')
    .forEach(el => {
      const element = el as HTMLElement;
      element.style.height = 'auto';
      element.style.maxHeight = 'none';
    });
};

const preserveCanvasContent = (original: Element, clone: Element) => {
  const originalCanvases = original.querySelectorAll('canvas');
  const clonedCanvases = clone.querySelectorAll('canvas');

  originalCanvases.forEach((originalCanvas, i) => {
    if (originalCanvases[i] && clonedCanvases[i]) {
      const clonedCanvas = clonedCanvases[i] as HTMLCanvasElement;
      const ctx = clonedCanvas.getContext('2d');
      if (ctx) {
        clonedCanvas.width = originalCanvas.width;
        clonedCanvas.height = originalCanvas.height;
        ctx.drawImage(originalCanvas, 0, 0);
      }
    }
  });
};

const createEnhancedClone = (
  originalElement: Element,
): { clone: HTMLElement; cleanup: () => void } => {
  const clone = originalElement.cloneNode(true) as HTMLElement;
  copyAllComputedStyles(originalElement, clone);
  preserveCanvasContent(originalElement, clone);

  const tempContainer = document.createElement('div');
  tempContainer.style.cssText = `
    position: absolute;
    left: -20000px;
    top: -20000px;
    visibility: hidden;
    pointer-events: none;
    z-index: -1000;
  `;
  tempContainer.appendChild(clone);
  document.body.appendChild(tempContainer);

  processCloneForVisibility(clone);

  const cleanup = () => {
    styleCache.delete?.(originalElement);
    if (tempContainer.parentElement) {
      tempContainer.parentElement.removeChild(tempContainer);
    }
  };

  return { clone, cleanup };
};

export default function downloadAsImageOptimized(
  selector: string,
  description: string,
  isExactSelector = false,
  theme?: SupersetTheme,
) {
  return async (event: SyntheticEvent) => {
    const elementToPrint = isExactSelector
      ? document.querySelector(selector)
      : event.currentTarget.closest(selector);

    if (!elementToPrint) {
      addWarningToast(
        t('Image download failed, please refresh and try again.'),
      );
      return;
    }

    let cleanup: (() => void) | null = null;

    try {
      const { clone, cleanup: cleanupFn } = createEnhancedClone(elementToPrint);
      cleanup = cleanupFn;

      const filter = (node: Element) =>
        typeof node.className === 'string'
          ? !node.className.includes('mapboxgl-control-container') &&
            !node.className.includes('header-controls')
          : true;

      const dataUrl = await domToImage.toJpeg(clone, {
        bgcolor: theme?.colorBgContainer,
        filter,
        quality: IMAGE_DOWNLOAD_QUALITY,
        height: clone.scrollHeight,
        width: clone.scrollWidth,
        cacheBust: true,
      });

      cleanup();
      cleanup = null;

      const link = document.createElement('a');
      link.download = `${generateFileStem(description)}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Creating image failed', error);
      addWarningToast(
        t('Image download failed, please refresh and try again.'),
      );
    } finally {
      if (cleanup) cleanup();
    }
  };
}
