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

import React, { CSSProperties, useMemo } from 'react';
import { css } from '@superset-ui/core';
import { t } from '../../translation';

const MIN_WIDTH_FOR_BODY = 250;

const generateContainerStyles: (
  height: number | string,
  width: number | string,
) => CSSProperties = (height: number | string, width: number | string) => ({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  height,
  justifyContent: 'center',
  padding: 16,
  textAlign: 'center',
  width,
});

type Props = {
  className?: string;
  height: number | string;
  id?: string;
  width: number | string;
};

const NoResultsComponent = ({ className, height, id, width }: Props) => {
  const containerStyles = useMemo(
    () => generateContainerStyles(height, width),
    [height, width],
  );

  // render the body if the width is auto/100% or greater than 250 pixels
  const shouldRenderBody =
    typeof width === 'string' || width > MIN_WIDTH_FOR_BODY;

  const BODY_STRING = t(
    'No results were returned for this query. If you expected results to be returned, ensure any filters are configured properly and the datasource contains data for the selected time range.',
  );

  return (
    <div
      className={className}
      id={id}
      style={containerStyles}
      title={shouldRenderBody ? undefined : BODY_STRING}
    >
      <div style={{ maxWidth: '800px' }}>
        <div
          css={theme => css`
            font-size: ${theme.typography.sizes.l}px;
            font-weight: ${theme.typography.weights.bold};
            padding-bottom: ${theme.gridUnit * 2}px;
          `}
        >
          {t('No Results')}
        </div>
        {shouldRenderBody && (
          <div
            css={theme => css`
              font-size: ${theme.typography.sizes.m}px;
            `}
          >
            {BODY_STRING}
          </div>
        )}
      </div>
    </div>
  );
};

export default NoResultsComponent;
