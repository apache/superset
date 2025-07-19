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

    // Check if element is scrollable
    const isScrollable = hasScrollableDescendant(elementToPrint as HTMLElement);
    let targetElement = elementToPrint as HTMLElement;
    let cloned: HTMLElement | null = null;
    const extraPadding = theme?.sizeUnit ? theme.sizeUnit * 2 : 16;
    if (isScrollable) {
      cloned = elementToPrint.cloneNode(true) as HTMLElement;
      cloned.style.overflow = 'visible';
      cloned.style.maxHeight = 'none';
      cloned.style.height = 'auto';
      cloned.style.width = `${elementToPrint.scrollWidth}px`;

      cloned.querySelectorAll<HTMLElement>('*').forEach(el => {
        // eslint-disable-next-line no-param-reassign
        el.style.overflow = 'visible';
        // eslint-disable-next-line no-param-reassign
        el.style.maxHeight = 'none';
        // eslint-disable-next-line no-param-reassign
        el.style.height = 'auto';
      });

      // Render off-screen
      cloned.style.position = 'absolute';
      cloned.style.top = '-9999px';
      cloned.style.left = '-9999px';
      document.body.appendChild(cloned);

      targetElement = cloned;
    }

    return domToImage
      .toJpeg(targetElement, {
        bgcolor: theme?.colors.grayscale.light4,
        height: targetElement.scrollHeight + extraPadding,
        width: targetElement.scrollWidth,
        filter,
      })
      .then((dataUrl: string) => {
        const link = document.createElement('a');
        link.download = `${generateFileStem(description)}.jpg`;
        link.href = dataUrl;
        link.click();
      })
      .catch((e: Error) => {
        console.error('Creating image failed', e);
      })
      .finally(() => {
        if (cloned) {
          document.body.removeChild(cloned);
        }
      });
  };
}

/**
 * Check if an element or any of its child elements is scrollable
 *
 * @param el - The HTMLElement to check for scrollable descendants.
 * @returns `true` if any descendant has scrollable overflow; otherwise `false`.
 */
function hasScrollableDescendant(el: HTMLElement): boolean {
  const treeWalker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
  let node = treeWalker.nextNode();

  while (node) {
    const element = node as HTMLElement;

    // Skip if element is .header-controls or inside .header-controls
    if (element.closest('.header-controls')) {
      node = treeWalker.nextNode();
      continue;
    }

    if (element.scrollHeight > element.clientHeight) {
      return true;
    }
    node = treeWalker.nextNode();
  }
  return false;
}
