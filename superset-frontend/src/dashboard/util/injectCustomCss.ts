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

function createStyleElement(className: string) {
  const style = document.createElement('style');
  style.className = className;
  style.type = 'text/css';
  return style;
}

// The original, non-typescript code referenced `style.styleSheet`.
// I can't find what sort of element would have a styleSheet property,
// so have created this type to satisfy TS without changing behavior.
type MysteryStyleElement = {
  styleSheet: {
    cssText: string;
  };
};

export default function injectCustomCss(css: string) {
  const className = 'CssEditor-css';
  const head = document.head || document.getElementsByTagName('head')[0];
  const style: HTMLStyleElement =
    document.querySelector(`.${className}`) || createStyleElement(className);

  if ('styleSheet' in style) {
    (style as HTMLStyleElement & MysteryStyleElement).styleSheet.cssText = css;
  } else {
    style.innerHTML = css;
  }

  /**
   * Ensures that the style applied is always the last.
   *
   * from: https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
   * The Node.appendChild() method adds a node to the end of the list of children
   * of a specified parent node. If the given child is a reference to an existing
   * node in the document, appendChild() moves it from its current position to the
   * new position (there is no requirement to remove the node from its parent node
   * before appending it to some other node).
   */

  head.appendChild(style);

  return function removeCustomCSS() {
    style.remove();
  };
}
