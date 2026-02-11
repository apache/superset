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
import { useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import ControlHeader, {
  ControlHeaderProps,
} from 'src/explore/components/ControlHeader';
import { styled } from '@apache-superset/core';
import {
  ControlComponentProps,
  safeParseEChartOptions,
  EChartOptionsParseError,
} from '@superset-ui/chart-controls';
import { EditorHost } from 'src/core/editors';
import { useDebounceValue } from 'src/hooks/useDebounceValue';

const Container = styled.div`
  border: 1px solid ${({ theme }) => theme.colorBorder};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  overflow: hidden;
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colorErrorText};
`;

export default function JSEditorControl({
  name,
  label,
  description,
  renderTrigger,
  hovered,
  tooltipOnClick,
  onChange,
  value,
}: ControlHeaderProps & ControlComponentProps<string>) {
  const debouncedValue = useDebounceValue(value);
  // safeParseEChartOptions;
  const error = useMemo(() => {
    try {
      safeParseEChartOptions(debouncedValue ?? '');
      return null;
    } catch (err) {
      if (err instanceof EChartOptionsParseError) {
        return err;
      }
      throw err;
    }
  }, [debouncedValue]);
  const headerProps = {
    name,
    label: label ?? name,
    description,
    renderTrigger,
    validationErrors: error?.message ? [error.message] : undefined,
    hovered,
    tooltipOnClick,
  };

  return (
    <>
      <ControlHeader {...headerProps} />
      <Container>
        <AutoSizer disableHeight>
          {({ width }) => (
            <EditorHost
              id="echart-js-editor"
              value={value ?? ''}
              onChange={val => onChange?.(val)}
              language="javascript"
              tabSize={2}
              lineNumbers
              width={`${width}px`}
              height="250px"
            />
          )}
        </AutoSizer>
      </Container>
      {error && (
        <ErrorMessage>
          {error.validationErrors.map(err => (
            <div key={err}>{err}</div>
          ))}
        </ErrorMessage>
      )}
    </>
  );
}
