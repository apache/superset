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
import React from 'react';
import { theme } from '@apache-superset/core';

const { useTheme } = theme;

interface PreBlockProps {
  /**
   * Strings render as-is, since tool results are already formatted text, and
   * anything else is pretty-printed as JSON. Values arrive server-redacted
   * and this component does no sanitizing of its own.
   */
  value: unknown;
  maxHeight: number;
  testId?: string;
}

/**
 * Scrollable read-only block shared by the tool and approval cards. Content
 * renders as text inside a `<pre>` and never as markup, so tool arguments
 * and results cannot inject anything into the panel.
 */
export default function PreBlock({ value, maxHeight, testId }: PreBlockProps) {
  const theme = useTheme();
  return (
    <pre
      data-test={testId}
      style={{
        margin: 0,
        padding: theme.paddingXS,
        background: theme.colorFillTertiary,
        borderRadius: theme.borderRadiusSM,
        fontSize: theme.fontSizeSM,
        maxHeight,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}
