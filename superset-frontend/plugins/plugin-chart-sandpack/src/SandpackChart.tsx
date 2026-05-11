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
import { styled } from '@apache-superset/core/theme';
import { useMemo } from 'react';
import { SandpackViewer } from './components/Sandpack/SandpackViewer';
import { DEFAULT_APP_CODE, DEFAULT_DEPENDENCIES } from './consts';
import { SandpackProps, SandpackStylesProps } from './types';

const Styles = styled.div<SandpackStylesProps>`
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow: hidden;
`;

function safeParseDependencies(raw?: string): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // fall through
  }
  return {};
}

export default function SandpackChart(props: SandpackProps) {
  const { data, height, width, formData } = props;
  const appCode = formData.appCode || DEFAULT_APP_CODE;
  const template = formData.template || 'react';
  const layout = formData.layout || 'split';
  const showNavigator = formData.showNavigator ?? false;

  const dependencies = useMemo(
    () => safeParseDependencies(formData.dependencies || DEFAULT_DEPENDENCIES),
    [formData.dependencies],
  );

  return (
    <Styles height={height} width={width}>
      <SandpackViewer
        appCode={appCode}
        data={data}
        dependencies={dependencies}
        template={template}
        layout={layout}
        showNavigator={showNavigator}
        height={height}
      />
    </Styles>
  );
}
