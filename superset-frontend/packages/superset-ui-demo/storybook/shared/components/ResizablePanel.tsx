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

import { PropsWithChildren, ReactNode } from 'react';
import {
  ResizableBox,
  ResizableBoxProps,
  ResizeCallbackData,
} from 'react-resizable';

import 'react-resizable/css/styles.css';

export type Size = ResizeCallbackData['size'];

export default function ResizablePanel({
  children,
  heading = undefined,
  initialSize = { width: 500, height: 300 },
  minConstraints = [100, 100] as [number, number],
  onResize,
  ...props
}: PropsWithChildren<Omit<ResizableBoxProps, 'width' | 'height'>> & {
  heading?: ReactNode;
  initialSize?: Size;
}) {
  const { width, height } = initialSize;
  return (
    <ResizableBox
      className="panel"
      width={width}
      height={height}
      minConstraints={minConstraints}
      onResize={
        onResize
          ? (e, data) => {
              const { size } = data;
              onResize(e, { ...data, size });
            }
          : undefined
      }
      {...props}
    >
      <>
        {heading ? <div className="panel-heading">{heading}</div> : null}
        <div className="panel-body">{children}</div>
      </>
    </ResizableBox>
  );
}
