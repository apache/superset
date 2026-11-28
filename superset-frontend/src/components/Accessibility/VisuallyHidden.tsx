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
import { ElementType, FC, ReactNode } from 'react';
import { styled } from '@apache-superset/core/theme';

/**
 * VisuallyHidden — content that is available to assistive technology but not
 * visually rendered. Use for screen-reader-only headings, labels, and live
 * regions where a duplicate visible element would be redundant.
 *
 * Renders a `<span>` by default. Pass `as` to render a different element
 * (e.g. `as="h1"` for an sr-only page heading).
 */
const HiddenElement = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

export interface VisuallyHiddenProps {
  /** Element type to render. Defaults to `'span'`. */
  as?: ElementType;
  children?: ReactNode;
  id?: string;
  className?: string;
}

const VisuallyHidden: FC<VisuallyHiddenProps> = ({
  as = 'span',
  children,
  ...rest
}) => (
  <HiddenElement as={as} {...rest}>
    {children}
  </HiddenElement>
);

export default VisuallyHidden;
