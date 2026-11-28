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
import domToPdf from 'dom-to-pdf';
import { kebabCase } from 'lodash-es';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import getBootstrapData from 'src/utils/getBootstrapData';
import { forceLoadAllCharts, restoreVirtualization } from './downloadUtils';

const pdfCompressionLevel = getBootstrapData().common.pdf_compression_level;

const PDF_DOWNLOAD_FAILED_MESSAGE = t(
  'PDF download failed, please refresh and try again.',
);

const UNEXPORTABLE_CANVAS_CLASS = 'pdf-export-unexportable-canvas';

/**
 * check whether a canvas can be read back, which fails with a SecurityError
 * once cross-origin content (e.g. external map tiles) has been drawn into it
 *
 * @param canvas canvas element to check
 */
const isCanvasExportable = (canvas: HTMLCanvasElement) => {
  try {
    canvas.toDataURL();
    return true;
  } catch {
    return false;
  }
};

/**
 * mark tainted canvases so dom-to-pdf leaves them out instead of failing the
 * whole export when it reads them
 *
 * @param element element that is about to be printed
 * @returns the canvases that were marked
 */
const markUnexportableCanvases = (element: Element) => {
  const canvases = Array.from(element.querySelectorAll('canvas')).filter(
    canvas => !isCanvasExportable(canvas),
  );
  canvases.forEach(canvas => canvas.classList.add(UNEXPORTABLE_CANVAS_CLASS));
  return canvases;
};

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

    const unexportableCanvases = markUnexportableCanvases(elementToPrint);

    const options = {
      margin: 10,
      compression: pdfCompressionLevel,
      filename: `${generateFileStem(description)}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2 },
      excludeClassNames: ['header-controls', UNEXPORTABLE_CANVAS_CLASS],
    };
    return domToPdf(elementToPrint, options)
      .then(() => {
        // nothing to be done
      })
      .catch((e: Error) => {
        logging.error('PDF generation failed', e);
        addWarningToast?.(PDF_DOWNLOAD_FAILED_MESSAGE);
      })
      .finally(() => {
        unexportableCanvases.forEach(canvas =>
          canvas.classList.remove(UNEXPORTABLE_CANVAS_CLASS),
        );
        if (didForceLoad) {
          restoreVirtualization();
        }
      });
  };
}
