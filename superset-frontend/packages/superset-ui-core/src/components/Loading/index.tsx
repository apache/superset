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

import { useEffect, useState } from 'react';
import { styled } from '@superset-ui/core';
import cls from 'classnames';
import type { LoadingProps } from './types';

export type PositionOption =
  | 'floating'
  | 'inline'
  | 'inline-centered'
  | 'normal';
export interface Props {
  position?: PositionOption;
  className?: string;
  image?: string;
}

const LoaderWrapper = styled.div`
  /* TODO: leverage new theme */
  & svg {
    --primary-color: ${({ theme }) => theme.colors.grayscale.dark2};
    --accent-color: ${({ theme }) => theme.colors.primary.base});
    overflow: visible;
  }

  /* new styles */
  padding: 10px;
  width: 100px;
  overflow: visible;

  z-index: 99;
  height: unset;
  position: relative;
  margin: 10px;
  &.inline {
    margin: 0px;
    width: 30px;
  }
  &.inline-centered {
    margin: 0 auto;
    width: 30px;
    display: block;
  }
  &.floating {
    /* padding: 0; */
    margin: 0;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
`;
export function Loading({ position = 'floating', className }: LoadingProps) {
  const [svgContent, setSvgContent] = useState('');

  useEffect(() => {
    console.log('Loading SVG');
    fetch('/static/assets/images/spinner.svg')
      .then(response => response.text())
      .then(htmlString => {
        setSvgContent(htmlString);
      });
  }, []);

  return (
    <LoaderWrapper
      className={cls('loading', position, className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

export type { LoadingProps };
