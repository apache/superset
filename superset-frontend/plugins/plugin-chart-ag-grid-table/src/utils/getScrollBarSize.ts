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
let cached: number | undefined;

const css = (x: TemplateStringsArray) => x.join('\n');

export default function getScrollBarSize(forceRefresh = false) {
  if (typeof document === 'undefined') {
    return 0;
  }
  if (cached === undefined || forceRefresh) {
    const inner = document.createElement('div');
    const outer = document.createElement('div');
    inner.style.cssText = css`
      width: auto;
      height: 100%;
      overflow: scroll;
    `;
    outer.style.cssText = css`
      position: absolute;
      visibility: hidden;
      overflow: hidden;
      width: 100px;
      height: 50px;
    `;
    outer.append(inner);
    document.body.append(outer);
    cached = outer.clientWidth - inner.clientWidth;
    outer.remove();
  }
  return cached;
}
