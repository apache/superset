/*
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

import { TextStyle, Dimension } from './types';
import updateTextNode from './svg/updateTextNode';
import getBBoxCeil from './svg/getBBoxCeil';
import { hiddenSvgFactory, textFactory } from './svg/factories';

export interface GetTextDimensionInput {
  className?: string;
  container?: HTMLElement;
  style?: TextStyle;
  text: string;
}

export default function getTextDimension(
  input: GetTextDimensionInput,
  defaultDimension?: Dimension,
): Dimension {
  const { text, className, style, container } = input;

  // Empty string
  if (text.length === 0) {
    return { height: 0, width: 0 };
  }

  const svgNode = hiddenSvgFactory.createInContainer(container);
  const textNode = textFactory.createInContainer(svgNode);
  updateTextNode(textNode, { className, style, text });
  const dimension = getBBoxCeil(textNode, defaultDimension);

  // The nodes are added to the DOM briefly only to make getBBox works.
  // (If not added to DOM getBBox will always return 0x0.)
  // After that the svg nodes are not needed.
  // We delay its removal in case there are subsequent calls to this function
  // that can reuse the svg nodes.
  // Experiments have shown that reusing existing nodes
  // instead of deleting and adding new ones can save lot of time.
  setTimeout(() => {
    textFactory.removeFromContainer(svgNode);
    hiddenSvgFactory.removeFromContainer(container);
  }, 500);

  return dimension;
}
