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
import { SupersetClient, logging } from '@superset-ui/core';
import rison from 'rison';
import contentDisposition from 'content-disposition';
import { ensureAppRoot } from './pathUtils';

export default async function handleResourceExport(
  resource: string,
  ids: number[],
  done: () => void,
): Promise<void> {
  const endpoint = ensureAppRoot(
    `/api/v1/${resource}/export/?q=${rison.encode(ids)}`,
  );

  try {
    // Use fetch with blob response instead of iframe to avoid CSP frame-src violations
    const response = await SupersetClient.get({
      endpoint,
      headers: {
        Accept: 'application/zip, application/x-zip-compressed, text/plain',
      },
      parseMethod: 'raw',
    });

    // Parse filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition');
    let fileName = `${resource}_export.zip`;

    if (disposition) {
      try {
        const parsed = contentDisposition.parse(disposition);
        if (parsed?.parameters?.filename) {
          fileName = parsed.parameters.filename;
        }
      } catch (error) {
        logging.warn('Failed to parse Content-Disposition header:', error);
      }
    }

    // Convert response to blob and trigger download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    done();
  } catch (error) {
    logging.error('Resource export failed:', error);
    done();
    throw error;
  }
}
