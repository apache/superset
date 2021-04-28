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

const copyTextToClipboard = async (text: string) =>
  new Promise<void>((resolve, reject) => {
    const selection: Selection | null = document.getSelection();
    if (selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      const span = document.createElement('span');
      span.textContent = text;
      span.style.position = 'fixed';
      span.style.top = '0';
      span.style.clip = 'rect(0, 0, 0, 0)';
      span.style.whiteSpace = 'pre';

      document.body.appendChild(span);
      range.selectNode(span);
      selection.addRange(range);

      try {
        if (!document.execCommand('copy')) {
          reject();
        }
      } catch (err) {
        reject();
      }

      document.body.removeChild(span);
      if (selection.removeRange) {
        selection.removeRange(range);
      } else {
        selection.removeAllRanges();
      }
    }

    resolve();
  });

export default copyTextToClipboard;
