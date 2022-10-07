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
import React, { useRef } from 'react';
import { styled, t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { Link } from 'react-router-dom';
import { useTruncation } from 'src/hooks/useTruncation';

export type CrossLinkProps = {
  title: string;
  id: number;
};

interface CrossLinksProps {
  crossLinks: Array<CrossLinkProps>;
  maxLinks?: number;
  linkPrefix?: string;
}

const StyledCrossLinks = styled.div`
  ${({ theme }) => `
    color: ${theme.colors.primary.dark1};
    cursor: pointer;
    max-width: calc(100% - 20px);

    .ant-tooltip-open {
      width: 100%;
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
      color: ${theme.colors.grayscale.base};
      font-weight: ${theme.typography.weights.bold};
    }
  `}
`;

const StyledLinkedTooltip = styled.div`
  .link {
    color: ${({ theme }) => theme.colors.grayscale.light5};
    display: block;
    text-decoration: underline;
  }
`;

export default function CrossLinks({
  crossLinks,
  maxLinks = 50,
  linkPrefix = '/superset/dashboard/',
}: CrossLinksProps) {
  const crossLinksRef = useRef<HTMLDivElement>(null);
  const [elementsTruncated, hasHiddenElements] = useTruncation(crossLinksRef);

  return (
    <StyledCrossLinks>
      {crossLinks.length > 1 ? (
        <Tooltip
          title={
            <StyledLinkedTooltip>
              {crossLinks.slice(0, maxLinks).map(link => (
                <Link
                  className="link"
                  key={link.id}
                  to={linkPrefix + link.id}
                  target="_blank"
                  rel="noreferer noopener"
                >
                  {link.title}
                </Link>
              ))}
              {crossLinks.length > maxLinks && (
                <span>{t('Plus %s more', crossLinks.length - maxLinks)}</span>
              )}
            </StyledLinkedTooltip>
          }
        >
          <span className="truncated" ref={crossLinksRef}>
            {crossLinks.map((element, index) => (
              <span>{index === 0 ? element.title : `, ${element.title}`}</span>
            ))}
          </span>
          {hasHiddenElements && (
            <span className="count">+{elementsTruncated}</span>
          )}
        </Tooltip>
      ) : (
        crossLinks[0] && (
          <Link
            to={linkPrefix + crossLinks[0].id}
            target="_blank"
            rel="noreferer noopener"
          >
            {crossLinks[0].title}
          </Link>
        )
      )}
    </StyledCrossLinks>
  );
}
