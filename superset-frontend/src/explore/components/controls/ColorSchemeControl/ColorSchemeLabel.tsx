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

import { css, SupersetTheme } from '@superset-ui/core';
import { useRef, useState } from 'react';
import { Tooltip } from 'src/components/Tooltip';

type ColorSchemeLabelProps = {
  colors: string[];
  id: string;
  label: string;
};

export default function ColorSchemeLabel(props: ColorSchemeLabelProps) {
  const { id, label, colors } = props;
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const labelNameRef = useRef<HTMLElement>(null);
  const labelsColorRef = useRef<HTMLElement>(null);
  const handleShowTooltip = () => {
    const labelNameElement = labelNameRef.current;
    const labelsColorElement = labelsColorRef.current;
    if (
      labelNameElement &&
      labelsColorElement &&
      (labelNameElement.scrollWidth > labelNameElement.offsetWidth ||
        labelNameElement.scrollHeight > labelNameElement.offsetHeight ||
        labelsColorElement.scrollWidth > labelsColorElement.offsetWidth ||
        labelsColorElement.scrollHeight > labelsColorElement.offsetHeight)
    ) {
      setShowTooltip(true);
    }
  };
  const handleHideTooltip = () => {
    setShowTooltip(false);
  };

  const colorsList = () =>
    colors.map((color: string, i: number) => (
      <span
        data-test="color"
        key={`${id}-${i}`}
        css={(theme: { gridUnit: number }) => css`
          padding-left: ${theme.gridUnit / 2}px;
          :before {
            content: '';
            display: inline-block;
            background-color: ${color};
            border: 1px solid ${color === 'white' ? 'black' : color};
            width: 9px;
            height: 10px;
          }
        `}
      />
    ));

  const tooltipContent = () => (
    <>
      <span>{label}</span>
      <div>{colorsList()}</div>
    </>
  );

  return (
    <Tooltip
      data-testid="tooltip"
      overlayClassName="color-scheme-tooltip"
      title={tooltipContent}
      key={id}
      visible={showTooltip}
    >
      <span
        className="color-scheme-option"
        onMouseEnter={handleShowTooltip}
        onMouseLeave={handleHideTooltip}
        css={css`
          display: flex;
          align-items: center;
          justify-content: flex-start;
        `}
        data-test={id}
      >
        <span
          className="color-scheme-label"
          ref={labelNameRef}
          css={(theme: SupersetTheme) => css`
            min-width: 125px;
            padding-right: ${theme.gridUnit * 2}px;
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
          `}
        >
          {label}
        </span>
        <span
          ref={labelsColorRef}
          css={(theme: SupersetTheme) => css`
            flex: 100%;
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
            padding-right: ${theme.gridUnit}px;
          `}
        >
          {colorsList()}
        </span>
      </span>
    </Tooltip>
  );
}
