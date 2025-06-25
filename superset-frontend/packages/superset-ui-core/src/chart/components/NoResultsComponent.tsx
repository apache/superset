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

import { CSSProperties } from 'react';
import { css, styled } from '../../style';
import { t } from '../../translation';

const MESSAGE_STYLES: CSSProperties = { maxWidth: 800 };
const MIN_WIDTH_FOR_BODY = 250;

const Container = styled.div<{
  width: number | string;
  height: number | string;
}>`
  ${({ theme, width, height }) => css`
    align-items: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    height: ${height}px;
    width: ${width}px;
    padding: ${theme.gridUnit * 4}px;

    & .no-results-title {
      font-size: ${theme.typography.sizes.l}px;
      font-weight: ${theme.typography.weights.bold};
      padding-bottom: ${theme.gridUnit * 2};
    }

    & .no-results-body {
      font-size: ${theme.typography.sizes.m}px;
    }
  `}
`;

type Props = {
  className?: string;
  height: number | string;
  id?: string;
  width: number | string;
};

const NoResultsComponent = ({ className, height, id, width }: Props) => {
  // render the body if the width is auto/100% or greater than 250 pixels
  const shouldRenderBody =
    typeof width === 'string' || width > MIN_WIDTH_FOR_BODY;

  const BODY_STRING = t(
    'No results were returned for this query. If you expected results to be returned, ensure any filters are configured properly and the datasource contains data for the selected time range.',
  );

  return (
    <Container
      height={height}
      width={width}
      className={className}
      id={id}
      title={shouldRenderBody ? undefined : BODY_STRING}
    >
      <div style={MESSAGE_STYLES}>
        <div className="no-results-title">{t('No Results')}</div>
        {shouldRenderBody && (
          <div className="no-results-body">{BODY_STRING}</div>
        )}
      </div>
    </Container>
  );
};

export default NoResultsComponent;
