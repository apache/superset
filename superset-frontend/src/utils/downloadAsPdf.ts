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
import { jsPDF, ImageCompression } from 'jspdf';
import { kebabCase } from 'lodash-es';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import getBootstrapData from 'src/utils/getBootstrapData';
import { createEnhancedClone, filterCssVariables } from './downloadAsImage';
import { forceLoadAllCharts, restoreVirtualization } from './downloadUtils';

const pdfCompressionLevel = getBootstrapData().common.pdf_compression_level;

const PDF_DOWNLOAD_FAILED_MESSAGE = t(
  'PDF download failed, please refresh and try again.',
);

// Standard A4 dimensions in typographic points (72 pt / inch)
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

/**
 * generate a consistent file stem from a description and date
 *
 * @param description title or description of content of file
 * @param date date when file was generated
 */
const generateFileStem = (description: string, date = new Date()) =>
  `${kebabCase(description)}-${date.toISOString().replace(/[: ]/g, '-')}`;

/**
 * Filter out unnecessary interactive elements and controls from the export.
 */
export const pdfFilterElement = (node: Node) => {
  if (node.nodeType === 1) {
    const el = node as HTMLElement;
    const tagName = el.tagName?.toUpperCase();
    if (tagName === 'BUTTON' || tagName === 'INPUT' || tagName === 'SELECT') {
      return false;
    }
    if (el.classList?.contains('header-controls')) {
      return false;
    }
  }
  return true;
};

export interface PageSlice {
  sourceY: number;
  sourceHeight: number;
}

/**
 * Calculate vertical slice offsets for multipage PDF export, avoiding splitting
 * individual child elements across page boundaries.
 */
export function calculatePageBreakOffsets(
  element: HTMLElement,
  canvasWidth: number,
  canvasHeight: number,
  pageHeightPx: number,
): PageSlice[] {
  if (pageHeightPx <= 0 || canvasHeight <= pageHeightPx) {
    return [{ sourceY: 0, sourceHeight: canvasHeight }];
  }

  const elementWidth = element.scrollWidth || element.clientWidth || 1;
  const scale = canvasWidth / elementWidth;

  const elementRect =
    typeof element.getBoundingClientRect === 'function'
      ? element.getBoundingClientRect()
      : { top: 0, bottom: element.clientHeight || 1 };

  const nodes =
    typeof element.querySelectorAll === 'function'
      ? Array.from(element.querySelectorAll('*'))
      : (Array.from(element.children || []) as Element[]);

  const childrenBoundaries: Array<{ top: number; bottom: number }> = [];

  for (const node of nodes) {
    if (typeof node.getBoundingClientRect === 'function') {
      const rect = node.getBoundingClientRect();
      const top = Math.round((rect.top - elementRect.top) * scale);
      const bottom = Math.round((rect.bottom - elementRect.top) * scale);
      if (bottom > top && bottom - top <= pageHeightPx) {
        childrenBoundaries.push({ top, bottom });
      }
    } else if (
      'offsetTop' in node &&
      typeof (node as HTMLElement).offsetTop === 'number'
    ) {
      const htmlNode = node as HTMLElement;
      const top = Math.round(htmlNode.offsetTop * scale);
      const height = htmlNode.offsetHeight || 0;
      const bottom = top + Math.round(height * scale);
      if (bottom > top && bottom - top <= pageHeightPx) {
        childrenBoundaries.push({ top, bottom });
      }
    }
  }

  // Deduplicate boundaries to minimize iterations and sort by top position
  const seen = new Set<string>();
  const uniqueBoundaries = childrenBoundaries
    .filter(({ top, bottom }) => {
      const key = `${top}:${bottom}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);

  const slices: PageSlice[] = [];
  let currentY = 0;

  while (currentY < canvasHeight) {
    const candidateEnd = currentY + pageHeightPx;
    if (candidateEnd >= canvasHeight) {
      slices.push({ sourceY: currentY, sourceHeight: canvasHeight - currentY });
      break;
    }

    let breakY = candidateEnd;
    for (const child of uniqueBoundaries) {
      if (
        child.top > currentY &&
        child.top < candidateEnd &&
        child.bottom > candidateEnd
      ) {
        if (child.top < breakY) {
          breakY = child.top;
        }
      }
    }

    // Safety fallback: if no valid break was found or breakY did not advance,
    // advance by pageHeightPx
    if (breakY <= currentY) {
      breakY = candidateEnd;
    }

    const sourceHeight = Math.min(breakY - currentY, canvasHeight - currentY);
    slices.push({ sourceY: currentY, sourceHeight });
    currentY += sourceHeight;
  }

  return slices;
}

/**
 * Render a DOM element to an A4 PDF document using dom-to-image-more and jsPDF,
 * skipping CSS custom variables to prevent browser tab crash (#45885).
 */
export async function renderElementToPdf(
  element: HTMLElement,
  filename: string,
  compression: ImageCompression = (pdfCompressionLevel as ImageCompression) ||
    'NONE',
): Promise<void> {
  const isDashboardCapture = element.classList.contains('dashboard');
  // Capture an expanded clone (matching image export) so scrollable tables and
  // clipped chart content are not cropped to their on-screen viewport, and
  // compute page break offsets against that expanded clone before cleanup.
  const { clone, cleanup } = createEnhancedClone(
    element,
    undefined,
    undefined,
    isDashboardCapture,
  );
  const innerRatio = A4_HEIGHT_PT / A4_WIDTH_PT;
  let canvas: HTMLCanvasElement;
  let slices: PageSlice[];
  try {
    const captureWidth = clone.scrollWidth;
    const captureHeight = clone.scrollHeight;
    canvas = await domToImage.toCanvas(clone, {
      filter: pdfFilterElement,
      filterStyles: filterCssVariables,
      bgcolor: 'white',
      ...(captureWidth > 0 && { width: captureWidth }),
      ...(captureHeight > 0 && { height: captureHeight }),
    });
    const pageHeightPx = Math.floor(canvas.width * innerRatio);
    slices = calculatePageBreakOffsets(
      clone,
      canvas.width,
      canvas.height,
      pageHeightPx,
    );
  } finally {
    cleanup();
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = canvas.width;
  const pageCtx = pageCanvas.getContext('2d');

  for (let page = 0; page < slices.length; page += 1) {
    const { sourceY, sourceHeight } = slices[page];
    pageCanvas.height = sourceHeight;

    if (pageCtx) {
      pageCtx.fillStyle = 'white';
      pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageCtx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sourceHeight,
        0,
        0,
        canvas.width,
        sourceHeight,
      );
    }

    const renderedPageHeight =
      canvas.width > 0
        ? (sourceHeight * A4_WIDTH_PT) / canvas.width
        : A4_HEIGHT_PT;
    const imgData = pageCanvas.toDataURL('image/png');

    if (page > 0) {
      pdf.addPage();
    }
    pdf.addImage(
      imgData,
      'PNG',
      0,
      0,
      A4_WIDTH_PT,
      renderedPageHeight,
      undefined,
      compression,
    );
  }

  pdf.save(filename);
}

/**
 * Create an event handler for turning an element into a PDF document
 *
 * @param selector css selector of the parent element which should be turned into image
 * @param description name or a short description of what is being printed.
 *   Value will be normalized, and a date as well as a file extension will be added.
 * @param isExactSelector if false, searches for the closest ancestor that matches selector.
 * @param addWarningToast bound via `useToasts()`/`bindActionCreators`, not the raw
 *   action creator from `actions.ts`: this module has no dispatch of its own, so an
 *   unbound creator would only build a Redux action object and never render a toast.
 * @param addInfoToast same contract as `addWarningToast`; announces a multi-batch
 *   export while charts are being forced into view.
 * @returns event handler
 */
export default function downloadAsPdf(
  selector: string,
  description: string,
  isExactSelector = false,
  addWarningToast?: (message: string) => void,
  addInfoToast?: (message: string) => void,
) {
  return async (event: SyntheticEvent) => {
    const elementToPrint = isExactSelector
      ? document.querySelector(selector)
      : event.currentTarget.closest(selector);

    if (!elementToPrint) {
      addWarningToast?.(PDF_DOWNLOAD_FAILED_MESSAGE);
      return;
    }

    // Force any virtualized (unmounted) charts to render before capturing, so
    // off-screen rows are not exported as loading spinners.
    const didForceLoad = await forceLoadAllCharts(
      elementToPrint,
      undefined,
      addWarningToast,
      addInfoToast,
    );

    const filename = `${generateFileStem(description)}.pdf`;

    return renderElementToPdf(
      elementToPrint as HTMLElement,
      filename,
      (pdfCompressionLevel as ImageCompression) || 'NONE',
    )
      .catch((e: Error) => {
        logging.error('PDF generation failed', e);
        addWarningToast?.(PDF_DOWNLOAD_FAILED_MESSAGE);
      })
      .finally(() => {
        if (didForceLoad) {
          restoreVirtualization();
        }
      });
  };
}
