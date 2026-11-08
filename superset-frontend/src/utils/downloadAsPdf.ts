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
import { jsPDF } from 'jspdf';
import { kebabCase } from 'lodash-es';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import getBootstrapData from 'src/utils/getBootstrapData';
import { filterCssVariables } from './downloadAsImage';
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

/**
 * Render a DOM element to an A4 PDF document using dom-to-image-more and jsPDF,
 * skipping CSS custom variables to prevent browser tab crash (#45885).
 */
export async function renderElementToPdf(
  element: HTMLElement,
  filename: string,
  compression: string = pdfCompressionLevel || 'NONE',
): Promise<void> {
  const canvas = await domToImage.toCanvas(element, {
    filter: pdfFilterElement,
    filterStyles: filterCssVariables,
    bgcolor: '#ffffff',
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const innerRatio = A4_HEIGHT_PT / A4_WIDTH_PT;
  const pageHeightPx = Math.floor(canvas.width * innerRatio);
  const totalPages = Math.ceil(canvas.height / pageHeightPx) || 1;

  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = canvas.width;
  const pageCtx = pageCanvas.getContext('2d');

  for (let page = 0; page < totalPages; page += 1) {
    const sourceY = page * pageHeightPx;
    const sourceHeight = Math.min(pageHeightPx, canvas.height - sourceY);
    pageCanvas.height = sourceHeight;

    if (pageCtx) {
      pageCtx.fillStyle = '#ffffff';
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

    const renderedPageHeight = (sourceHeight * A4_WIDTH_PT) / canvas.width;
    const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);

    if (page > 0) {
      pdf.addPage();
    }
    pdf.addImage(
      imgData,
      'JPEG',
      0,
      0,
      A4_WIDTH_PT,
      renderedPageHeight,
      undefined,
      compression as any,
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
      pdfCompressionLevel,
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
