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

import { css } from '@emotion/react';
import React, { useEffect, useRef, useState } from 'react';

/**
 * Importable CSS that enables text truncation on fixed-width block
 * elements.
 */
export const truncationCSS = css`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/**
 * This hook encapsulates logic supporting truncation of text via
 * the CSS "text-overflow: ellipsis;" feature.  Given the text content
 * to be displayed, this hook returns a ref to attach to the text
 * element and a boolean for whether that element is currently truncated.
 */
const useCSSTextTruncation = <T extends HTMLElement>(
  text: string,
): [React.RefObject<T>, boolean] => {
  const ref = useRef<T>(null);
  const [isTruncated, setIsTruncated] = useState(true);
  useEffect(() => {
    if (ref.current) {
      setIsTruncated(ref.current.offsetWidth < ref.current.scrollWidth);
    }
  }, [text]);

  return [ref, isTruncated];
};

export default useCSSTextTruncation;
