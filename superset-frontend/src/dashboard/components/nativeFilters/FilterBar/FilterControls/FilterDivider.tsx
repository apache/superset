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
import React from 'react';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import { useCSSTextTruncation, truncationCSS } from 'src/hooks/useTruncation';

export interface FilterDividerProps {
  title: string;
  description: string;
  horizontal?: boolean;
  overflow?: boolean;
}

const VerticalDivider = ({ title, description }: FilterDividerProps) => (
  <div>
    <h3>{title}</h3>
    {description ? <p data-test="divider-description">{description}</p> : null}
  </div>
);

const HorizontalDivider = ({ title, description }: FilterDividerProps) => {
  const [titleRef, titleIsTruncated] =
    useCSSTextTruncation<HTMLHeadingElement>(title);

  const tooltipOverlay = (
    <>
      {titleIsTruncated ? (
        <div>
          <strong>{title}</strong>
        </div>
      ) : null}
      {description ? <div>{description}</div> : null}
    </>
  );

  return (
    <div
      css={(theme: SupersetTheme) => css`
        display: flex;
        align-items: center;
        height: ${8 * theme.gridUnit}px;
        border-left: 1px solid ${theme.colors.grayscale.light2};
        padding-left: ${4 * theme.gridUnit}px;
        margin-right: ${4 * theme.gridUnit}px;
      `}
    >
      <h3
        ref={titleRef}
        css={(theme: SupersetTheme) => css`
          ${truncationCSS}
          max-width: 130px;
          font-size: 14px;
          font-weight: normal;
          margin: 0;
          color: ${theme.colors.grayscale.dark1};
        `}
      >
        {title}
      </h3>
      {titleIsTruncated || description ? (
        <Tooltip overlay={tooltipOverlay}>
          <Icons.BookOutlined
            data-test="divider-description-icon"
            css={(theme: SupersetTheme) => css`
              color: ${theme.colors.grayscale.base};
              font-size: 16px;
              margin: 0 ${theme.gridUnit * 1.5}px;
              vertical-align: unset;
              line-height: unset;
            `}
          />
        </Tooltip>
      ) : null}
    </div>
  );
};

const HorizontalOverflowDivider = ({
  title,
  description,
}: FilterDividerProps) => {
  const [titleRef, titleIsTruncated] =
    useCSSTextTruncation<HTMLHeadingElement>(title);

  const [descriptionRef, descriptionIsTruncated] =
    useCSSTextTruncation<HTMLHeadingElement>(description);

  return (
    <div
      css={(theme: SupersetTheme) => css`
        border-top: 1px solid ${theme.colors.grayscale.light2};
        padding-top: ${theme.gridUnit * 4}px;
        &:not(&:last-child) {
          margin-bottom: ${theme.gridUnit * 4}px;
        }
      `}
    >
      <Tooltip overlay={titleIsTruncated ? <strong>{title}</strong> : null}>
        <h3
          ref={titleRef}
          css={(theme: SupersetTheme) => css`
            ${truncationCSS}
            display: block;
            color: ${theme.colors.grayscale.dark1};
            font-weight: normal;
            font-size: 14px;
            margin: 0 0 ${theme.gridUnit}px 0;
          `}
        >
          {title}
        </h3>
      </Tooltip>
      {description ? (
        <Tooltip overlay={descriptionIsTruncated ? description : null}>
          <p
            ref={descriptionRef}
            data-test="divider-description"
            css={(theme: SupersetTheme) => css`
              ${truncationCSS}
              display: block;
              font-size: 12px;
              color: ${theme.colors.grayscale.base};
              margin: 0;
            `}
          >
            {description}
          </p>
        </Tooltip>
      ) : null}
    </div>
  );
};

const FilterDivider = ({
  title,
  description,
  horizontal = false,
  overflow = false,
}: FilterDividerProps) => {
  if (horizontal) {
    if (overflow) {
      return (
        <HorizontalOverflowDivider title={title} description={description} />
      );
    }

    return <HorizontalDivider title={title} description={description} />;
  }

  return <VerticalDivider title={title} description={description} />;
};

export default FilterDivider;
