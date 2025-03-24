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
import { memo, useMemo } from 'react';
import { styled, useTruncation } from '@superset-ui/core';
import { Link } from 'react-router-dom';
import CrossLinksTooltip from './CrossLinksTooltip';

export type CrossLinkProps = {
  title: string;
  id: number;
};

export type CrossLinksProps = {
  crossLinks: Array<CrossLinkProps>;
  maxLinks?: number;
  linkPrefix?: string;
};

const StyledCrossLinks = styled.div`
  ${({ theme }) => `
    & > span {
      width: 100%;
      display: flex;

      .antd5-tooltip-open {
        display: inline;
      }

      .truncated {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: inline-block;
        width: 100%;
        vertical-align: bottom;
      }

      .count {
        cursor: pointer;
        color: ${theme.colors.grayscale.base};
        font-weight: ${theme.typography.weights.bold};
      }
    }
  `}
`;

function CrossLinks({
  crossLinks,
  maxLinks = 20,
  linkPrefix = '/superset/dashboard/',
}: CrossLinksProps) {
  const [crossLinksRef, plusRef, elementsTruncated, hasHiddenElements] =
    useTruncation();
  const hasMoreItems = useMemo(
    () =>
      crossLinks.length > maxLinks ? crossLinks.length - maxLinks : undefined,
    [crossLinks, maxLinks],
  );
  const links = useMemo(
    () => (
      <span className="truncated" ref={crossLinksRef} data-test="crosslinks">
        {crossLinks.map((link, index) => (
          <Link key={link.id} to={linkPrefix + link.id}>
            {index === 0 ? link.title : `, ${link.title}`}
          </Link>
        ))}
      </span>
    ),
    [crossLinks, crossLinksRef, linkPrefix],
  );
  const tooltipLinks = useMemo(
    () =>
      crossLinks.slice(0, maxLinks).map(l => ({
        title: l.title,
        to: linkPrefix + l.id,
      })),
    [crossLinks, linkPrefix, maxLinks],
  );

  return (
    <StyledCrossLinks>
      <CrossLinksTooltip
        moreItems={hasMoreItems}
        crossLinks={tooltipLinks}
        show={!!elementsTruncated}
      >
        {links}
        {hasHiddenElements && (
          <span ref={plusRef} className="count" data-test="count-crosslinks">
            +{elementsTruncated}
          </span>
        )}
      </CrossLinksTooltip>
    </StyledCrossLinks>
  );
}

export default memo(CrossLinks);
