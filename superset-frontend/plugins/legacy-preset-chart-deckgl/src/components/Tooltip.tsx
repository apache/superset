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

import React, { useMemo, CSSProperties } from 'react';
import { filterXSS } from 'xss';

export type TooltipProps = {
  tooltip:
    | {
        x: number;
        y: number;
        content: string;
      }
    | null
    | undefined;
};

export default function Tooltip(props: TooltipProps) {
  const { tooltip } = props;
  if (typeof tooltip === 'undefined' || tooltip === null) {
    return null;
  }

  const { x, y, content } = tooltip;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const style: CSSProperties = useMemo(
    () => ({
      position: 'absolute',
      top: `${y}px`,
      left: `${x}px`,
      padding: '8px',
      margin: '8px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#fff',
      maxWidth: '300px',
      fontSize: '12px',
      zIndex: 9,
      pointerEvents: 'none',
    }),
    [x, y],
  );

  if (typeof content === 'string') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const contentHtml = useMemo(
      () => ({
        __html: filterXSS(content, { stripIgnoreTag: true }),
      }),
      [content],
    );
    return (
      <div style={style}>
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={contentHtml}
        />
      </div>
    );
  }

  return <div style={style}>{content}</div>;
}
