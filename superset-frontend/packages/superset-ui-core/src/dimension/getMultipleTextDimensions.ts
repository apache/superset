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
import getBBoxCeil from './svg/getBBoxCeil';
import { hiddenSvgFactory, textFactory } from './svg/factories';
import updateTextNode from './svg/updateTextNode';

/**
 * get dimensions of multiple texts with same style
 * @param input
 * @param defaultDimension
 */
export default function getMultipleTextDimensions(
  input: {
    className?: string;
    container?: HTMLElement;
    style?: TextStyle;
    texts: string[];
  },
  defaultDimension?: Dimension,
): Dimension[] {
  const { texts, className, style, container } = input;

  const cache = new Map<string, Dimension>();
  // for empty string
  cache.set('', { height: 0, width: 0 });
  let textNode: SVGTextElement | undefined;
  let svgNode: SVGSVGElement | undefined;

  const dimensions = texts.map(text => {
    // Check if this string has been computed already
    if (cache.has(text)) {
      return cache.get(text) as Dimension;
    }

    // Lazy creation of text and svg nodes
    if (!textNode) {
      svgNode = hiddenSvgFactory.createInContainer(container);
      textNode = textFactory.createInContainer(svgNode);
    }

    // Update text and get dimension
    updateTextNode(textNode, { className, style, text });
    const dimension = getBBoxCeil(textNode, defaultDimension);
    // Store result to cache
    cache.set(text, dimension);

    return dimension;
  });

  // Remove svg node, if any
  if (svgNode && textNode) {
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
  }

  return dimensions;
}
