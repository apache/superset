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
import React, { useEffect, useRef, useState } from 'react';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';

export interface FilterDividerProps {
  title: string;
  description: string;
  horizontal?: boolean;
  horizontalOverflow?: boolean;
}

const useIsTruncated = <T extends HTMLElement>(): [
  React.RefObject<T>,
  boolean,
] => {
  const ref = useRef<T>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  useEffect(() => {
    if (ref.current) {
      setIsTruncated(ref.current.offsetWidth < ref.current.scrollWidth);
    }
  }, []);

  return [ref, isTruncated];
};

const VerticalDivider = ({ title, description }: FilterDividerProps) => (
  <div>
    <h3>{title}</h3>
    {description ? <p data-test="divider-description">{description}</p> : null}
  </div>
);

const HorizontalDivider = ({ title, description }: FilterDividerProps) => {
  const [titleRef, titleIsTruncated] = useIsTruncated<HTMLHeadingElement>();
  const tooltipOverlay = (
    <>
      {titleIsTruncated ? <h3>{title}</h3> : null}
      {description ? <p>{description}</p> : null}
    </>
  );

  return (
    <div
      css={(theme: SupersetTheme) => css`
        display: flex;
        flex-direction: column;
        border-left: 1px solid ${theme.colors.grayscale.light2};
      `}
    >
      <h3
        ref={titleRef}
        css={css`
          max-width: 130px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `}
      >
        {title}
      </h3>
      {titleIsTruncated || description ? (
        <Tooltip overlay={tooltipOverlay}>
          <Icons.BookOutlined data-test="divider-description-icon" />
        </Tooltip>
      ) : null}
    </div>
  );
};

const HorizontalOverflowDivider = ({
  title,
  description,
}: FilterDividerProps) => {
  const [titleRef, titleIsTruncated] = useIsTruncated<HTMLHeadingElement>();
  const [descriptionRef, descriptionIsTruncated] =
    useIsTruncated<HTMLHeadingElement>();
  return (
    <div
      css={(theme: SupersetTheme) => css`
        border-left: 1px solid ${theme.colors.grayscale.light2};
      `}
    >
      <Tooltip overlay={titleIsTruncated ? title : null}>
        <h3
          ref={titleRef}
          css={css`
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          `}
        >
          {title}
        </h3>
      </Tooltip>
      <Tooltip overlay={descriptionIsTruncated ? description : null}>
        <p
          ref={descriptionRef}
          data-test="divider-description"
          css={css`
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          `}
        >
          {description}
        </p>
      </Tooltip>
    </div>
  );
};

const FilterDivider = ({
  title,
  description,
  horizontal = false,
  horizontalOverflow = false,
}: FilterDividerProps) => {
  if (horizontal) {
    if (horizontalOverflow) {
      return (
        <HorizontalOverflowDivider title={title} description={description} />
      );
    }

    return <HorizontalDivider title={title} description={description} />;
  }

  return <VerticalDivider title={title} description={description} />;
};

export default FilterDivider;
