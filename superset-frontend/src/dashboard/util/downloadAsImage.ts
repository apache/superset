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
import { MouseEvent, MouseEventHandler } from 'react';
import domToImage from 'dom-to-image';
import kebabCase from 'lodash/kebabCase';

/**
 * generate a consistent file stem from a description and date
 *
 * @param description title or description of content of file
 * @param date date when file was generated
 */
export const generateFileStem = (description: string, date = new Date()) => {
  return `${kebabCase(description)}-${date
    .toISOString()
    .replace(/[: ]/g, '-')}`;
};

/**
 * Create an event handler for turning an element into an image
 *
 * @param selector css selector of the parent element which should be turned into image
 * @param fileStem name of generated file, without extension
 * @param backgroundColor background color to apply to screenshot document
 */
export const downloadAsImage = (
  selector: string,
  fileStem: string,
  backgroundColor = '#f5f5f5',
): MouseEventHandler => (event: MouseEvent) => {
  const elementToPrint = event.currentTarget.closest(selector);

  if (!elementToPrint) throw new Error('printable element not found');

  domToImage
    .toJpeg(elementToPrint, { quality: 0.95, bgcolor: backgroundColor })
    .then(dataUrl => {
      const link = document.createElement('a');
      link.download = `${fileStem}.jpeg`;
      link.href = dataUrl;
      link.click();
    });
};

export default downloadAsImage;
