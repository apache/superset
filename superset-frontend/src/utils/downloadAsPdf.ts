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
import { kebabCase } from 'lodash';
/* NGLS - BEGIN */
import domToImage from 'dom-to-image-more';
import { jsPDF } from 'jspdf';
import { t } from '@superset-ui/core';
/* NGLS - END */
import { addWarningToast } from 'src/components/MessageToasts/actions';

/* NGLS - BEGIN */
const MARGIN_PT = 10;

/**
 * generate a consistent file stem from a description and date
 *
 * @param description title or description of content of file
 * @param date date when file was generated
 */
const generateFileStem = (description: string, date = new Date()) =>
  `${kebabCase(description)}-${date.toISOString().replace(/[: ]/g, '-')}`;

/* NGLS - BEGIN */
/**
 * Generate and save the PDF file
 *
 * @param canvas the canvas element populated by dom-to-image-more package.
 * @param file the PDF filename.
 * @returns promise resolved when PDF is saved
 */
const generatePdf = (canvas: HTMLCanvasElement, filename: string) => {
  // Canvas width and height in pixels
  const { width: canvasWidthPx, height: canvasHeightPx } = canvas;

  const pdf = new jsPDF({
    orientation: 'l', // Always use landscape
    unit: 'pt',
    format: 'letter',
    compress: true,
  });

  // PDF page width and height in points
  const pageWidthPt = pdf.internal.pageSize.width;
  const pageHeightPt = pdf.internal.pageSize.height - 2 * MARGIN_PT;

  // Calculate the height of a single page in pixels
  const pageRatio = pageHeightPt / pageWidthPt;
  const pageHeightPx = Math.floor(canvasWidthPx * pageRatio);

  // Calculate the number of pages
  const nPages = Math.ceil(canvasHeightPx / pageHeightPx);

  let adjustedCanvas;
  if (canvasHeightPx % pageHeightPx !== 0) {
    // Create an adjusted canvas with the exact size of the PDF pages
    adjustedCanvas = document.createElement('canvas');
    adjustedCanvas.width = canvasWidthPx;
    adjustedCanvas.height = nPages * pageHeightPx;
    adjustedCanvas.style.backgroundColor = 'white';
    // Copy original canvas content
    const ctx = adjustedCanvas.getContext('2d');
    ctx!.drawImage(
      canvas,
      0,
      0,
      canvasWidthPx,
      canvasHeightPx,
      0,
      0,
      canvasWidthPx,
      canvasHeightPx,
    );
  } else {
    adjustedCanvas = canvas;
  }

  if (nPages === 1) {
    pdf.addImage(
      adjustedCanvas.toDataURL('image/PNG'),
      'PNG',
      0,
      MARGIN_PT,
      pageWidthPt,
      pageHeightPt,
    );
  } else {
    // Create separate canvas for each page
    const pageCanvas = document.createElement('canvas');
    const pageCtx = pageCanvas.getContext('2d');
    pageCanvas.width = canvasWidthPx;
    pageCanvas.height = pageHeightPx;
    const { width: w, height: h } = pageCanvas;

    let pageNr = 0;
    while (pageNr < nPages) {
      pageCtx!.fillStyle = 'white';
      pageCtx!.fillRect(0, 0, w, h);
      pageCtx!.drawImage(
        adjustedCanvas,
        0,
        pageNr * pageHeightPx,
        w,
        h,
        0,
        0,
        w,
        h,
      );

      // Add a new page to the PDF.
      if (pageNr > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        pageCanvas.toDataURL('image/PNG'),
        'PNG',
        0,
        MARGIN_PT,
        pageWidthPt,
        pageHeightPt,
      );
      pageNr += 1;
    }
  }

  return pdf.save(filename);
};
/* NGLS - END */

/**
 * Create an event handler for turning an element into an image
 *
 * @param selector css selector of the parent element which should be turned into image
 * @param description name or a short description of what is being printed.
 *   Value will be normalized, and a date as well as a file extension will be added.
 * @param isExactSelector if false, searches for the closest ancestor that matches selector.
 * @returns event handler
 */
export default function downloadAsPdf(
  selector: string,
  description: string,
  isExactSelector = false,
) {
  return (event: SyntheticEvent) => {
    const elementToPrint = isExactSelector
      ? document.querySelector(selector)
      : event.currentTarget.closest(selector);

    if (!elementToPrint) {
      return addWarningToast(
        t('PDF download failed, please refresh and try again.'),
      );
    }
    /* NGLS - BEGIN */
    // Mapbox controls are loaded from different origin, causing CORS error
    // See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL#exceptions
    const filter = (node: Element) => {
      if (typeof node.className === 'string') {
        return (
          node.className !== 'mapboxgl-control-container' &&
          !node.className.includes('ant-dropdown')
        );
      }
      return true;
    };

    return domToImage
      .toCanvas(elementToPrint, {
        /* eslint-disable-next-line superset-theme-colors/no-literal-colors */
        bgcolor: 'white',
        filter,
      })
      .then((canvas: HTMLCanvasElement) => {
        generatePdf(canvas, `${generateFileStem(description)}.pdf`);
      })
      .catch((e: unknown) => {
        console.error('Creating PDF failed', e);
      });
    /* NGLS - END */
  };
}
