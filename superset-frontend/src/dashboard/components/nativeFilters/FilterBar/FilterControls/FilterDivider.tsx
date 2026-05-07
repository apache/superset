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

import {
  css,
  useTheme,
  useCSSTextTruncation,
  truncationCSS,
} from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '@superset-ui/core/components';
import { FilterBarOrientation } from 'src/dashboard/types';
import { FilterDividerProps } from './types';

const VerticalDivider = ({ title, description }: FilterDividerProps) => (
  <div>
    <h3>{title}</h3>
    {description ? <p data-test="divider-description">{description}</p> : null}
  </div>
);

const HorizontalDivider = ({ title, description }: FilterDividerProps) => {
  const theme = useTheme();
  const [titleRef, titleIsTruncated] =
    useCSSTextTruncation<HTMLHeadingElement>();

  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        height: ${6 * theme.sizeUnit}px;
        border-left: 1px solid ${theme.colorSplit};
        padding-left: ${4 * theme.sizeUnit}px;

        .filter-item-wrapper:first-child & {
          border-left: none;
          padding-left: 0;
        }
      `}
    >
      <Tooltip overlay={titleIsTruncated ? title : null}>
        <h3
          ref={titleRef}
          css={css`
            ${truncationCSS};
            max-width: ${theme.sizeUnit * 32.5}px;
            font-size: ${theme.fontSize}px;
            font-weight: ${theme.fontWeightNormal};
            margin: 0;
            color: ${theme.colorText};
          `}
        >
          {title}
        </h3>
      </Tooltip>
      {description ? (
        <Tooltip overlay={description}>
          <Icons.BookOutlined
            data-test="divider-description-icon"
            iconSize="l"
            css={css`
              margin: 0 ${theme.sizeUnit * 1.5}px;
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
  const theme = useTheme();
  const [titleRef, titleIsTruncated] =
    useCSSTextTruncation<HTMLHeadingElement>();

  const [descriptionRef, descriptionIsTruncated] =
    useCSSTextTruncation<HTMLHeadingElement>();

  return (
    <div
      css={css`
        border-top: 1px solid ${theme.colorSplit};
        padding-top: ${theme.sizeUnit * 4}px;
        margin-bottom: ${theme.sizeUnit * 4}px;
      `}
    >
      <Tooltip overlay={titleIsTruncated ? <strong>{title}</strong> : null}>
        <h3
          ref={titleRef}
          css={css`
            ${truncationCSS};
            display: block;
            color: ${theme.colorText};
            font-weight: ${theme.fontWeightNormal};
            font-size: ${theme.fontSize}px;
            margin: 0 0 ${theme.sizeUnit}px 0;
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
            css={css`
              ${truncationCSS};
              display: block;
              font-size: ${theme.fontSizeSM}px;
              color: ${theme.colorTextDescription};
              margin: ${theme.sizeUnit}px 0 0 0;
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
  orientation = FilterBarOrientation.Vertical,
  overflow = false,
}: FilterDividerProps) => {
  if (orientation === FilterBarOrientation.Horizontal) {
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
