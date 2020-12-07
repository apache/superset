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
import domToImage, { Options } from 'dom-to-image';
import kebabCase from 'lodash/kebabCase';
import { t } from '@superset-ui/core';
import { addWarningToast } from 'src/messageToasts/actions';

/**
 * @remark
 * same as https://github.com/apache/incubator-superset/blob/c53bc4ddf9808a8bb6916bbe3cb31935d33a2420/superset-frontend/stylesheets/less/variables.less#L34
 */
const GRAY_BACKGROUND_COLOR = '#F5F5F5';

/**
 * generate a consistent file stem from a description and date
 *
 * @param description title or description of content of file
 * @param date date when file was generated
 */
const generateFileStem = (description: string, date = new Date()) => {
  return `${kebabCase(description)}-${date
    .toISOString()
    .replace(/[: ]/g, '-')}`;
};

/**
 * Create an event handler for turning an element into an image
 *
 * @param selector css selector of the parent element which should be turned into image
 * @param description name or a short description of what is being printed.
 *   Value will be normalized, and a date as well as a file extension will be added.
 * @param backgroundColor background color to apply to screenshot document
 * @returns event handler
 */
export default function downloadAsImage(
  selector: string,
  description: string,
  domToImageOptions: Options = {},
) {
  return (event: SyntheticEvent) => {
    const elementToPrint = event.currentTarget.closest(selector);

    if (!elementToPrint) {
      return addWarningToast(
        t('Image download failed, please refresh and try again.'),
      );
    }

    return domToImage
      .toJpeg(elementToPrint, {
        quality: 0.95,
        bgcolor: GRAY_BACKGROUND_COLOR,
        ...domToImageOptions,
      })
      .then(dataUrl => {
        const link = document.createElement('a');
        link.download = `${generateFileStem(description)}.jpg`;
        link.href = dataUrl;
        link.click();
      });
  };
}
