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

/**
 * generate a consistent file stem from a description and date
 *
 * @param description title or description of content of file
 * @param date date when file was generated
 */
const generateFileStem = (description: string, date = new Date()) =>
  `${kebabCase(description)}-${date.toISOString().replace(/[: ]/g, '-')}`;

/**
 * Enhanced clone function that preserves all visual elements including cell bars
 */
const createEnhancedClone = (originalElement: Element): HTMLElement => {
  const clone = originalElement.cloneNode(true) as HTMLElement;

  // Create container for the clone
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-20000px';
  tempContainer.style.top = '-20000px';
  tempContainer.style.visibility = 'hidden';
  tempContainer.style.pointerEvents = 'none';
  tempContainer.style.zIndex = '-1000';

  // Copy computed styles recursively
  const copyComputedStyles = (source: Element, target: Element) => {
    const sourceComputed = window.getComputedStyle(source);
    const targetElement = target as HTMLElement;

    // Copy essential styles
    for (let i = 0; i < sourceComputed.length; i += 1) {
      const property = sourceComputed[i];
      const value = sourceComputed.getPropertyValue(property);
      targetElement.style.setProperty(property, value);
    }
  };

  tempContainer.appendChild(clone);
  document.body.appendChild(tempContainer);

  // Copy styles from original to clone recursively
  const copyStylesRecursively = (originalNode: Element, cloneNode: Element) => {
    copyComputedStyles(originalNode, cloneNode);

    const originalChildren = originalNode.children;
    const cloneChildren = cloneNode.children;

    for (
      let i = 0;
      i < originalChildren.length && i < cloneChildren.length;
      i += 1
    ) {
      copyStylesRecursively(originalChildren[i], cloneChildren[i]);
    }
  };

  copyStylesRecursively(originalElement, clone);

  clone.style.height = 'auto';

  // Handle scrollable containers
  const scrollableElements = clone.querySelectorAll(
    '[style*="overflow"], .scrollable, .table-responsive, .ant-table-body, .table-container, .ant-table-container, .table-wrapper, .ant-table-tbody, tbody, .table-body',
  );

  scrollableElements.forEach(el => {
    const element = el as HTMLElement;
    element.style.overflow = 'visible';
    element.style.height = 'auto';
    element.style.maxHeight = 'none';
  });

  // Center tables and ensure proper display
  const tables = clone.querySelectorAll('table, .ant-table, .table-container');
  tables.forEach(table => {
    const tableElement = table as HTMLElement;
    tableElement.style.margin = '0 auto';
    tableElement.style.display = 'table';
  });

  // Ensure all rows are visible
  const allRows = clone.querySelectorAll('tr, .ant-table-row, .table-row');
  allRows.forEach(row => {
    const rowElement = row as HTMLElement;
    rowElement.style.display = 'table-row';
    rowElement.style.visibility = 'visible';
  });

  return clone;
};

/**
 * Create an event handler for turning an element into an image
 *
 * @param selector css selector of the parent element which should be turned into image
 * @param description name or a short description of what is being printed.
 *   Value will be normalized, and a date as well as a file extension will be added.
 * @param isExactSelector if false, searches for the closest ancestor that matches selector.
 * @returns event handler
 */
export default function downloadAsImage(
  selector: string,
  description: string,
  isExactSelector = false,
  theme?: SupersetTheme,
) {
  return (event: SyntheticEvent) => {
    const elementToPrint = isExactSelector
      ? document.querySelector(selector)
      : event.currentTarget.closest(selector);

    if (!elementToPrint) {
      return addWarningToast(
        t('Image download failed, please refresh and try again.'),
      );
    }

    // Create enhanced clone with full content and preserved cell bars
    const clonedElement = createEnhancedClone(elementToPrint);

    // Mapbox controls are loaded from different origin, causing CORS error
    // See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL#exceptions
    const filter = (node: Element) => {
      if (typeof node.className === 'string') {
        return (
          node.className !== 'mapboxgl-control-container' &&
          !node.className.includes('header-controls')
        );
      }
      return true;
    };

    return domToImage
      .toJpeg(clonedElement, {
        bgcolor: theme?.colors.grayscale.light4,
        filter,
        quality: 0.95,
        height: clonedElement.scrollHeight,
        width: clonedElement.scrollWidth,
      })
      .then((dataUrl: string) => {
        // Clean up the cloned element
        const tempContainer = clonedElement.parentElement;
        if (tempContainer && tempContainer.parentElement) {
          tempContainer.parentElement.removeChild(tempContainer);
        }

        const link = document.createElement('a');
        link.download = `${generateFileStem(description)}.jpg`;
        link.href = dataUrl;
        link.click();
      })
      .catch((e: Error) => {
        // Clean up the cloned element in case of error
        const tempContainer = clonedElement.parentElement;
        if (tempContainer && tempContainer.parentElement) {
          tempContainer.parentElement.removeChild(tempContainer);
        }
        console.error('Creating image failed', e);
        addWarningToast(
          t('Image download failed, please refresh and try again.'),
        );
      });
  };
}
