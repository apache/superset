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
import React from 'react';
import { styled, t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { Link } from 'react-router-dom';

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
  color: ${({ theme }) => theme.colors.primary.dark1};
  cursor: pointer;

  .ant-tooltip-open {
    max-width: 100%;
  }

  .truncated {
    max-width: calc(100% - 20px);
    white-space: nowrap;
    display: inline-block;
    overflow: hidden;
    vertical-align: bottom;
    text-overflow: ellipsis;
  }
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
          <span className="truncated">
            {crossLinks.map(link => link.title).join(', ')}
          </span>{' '}
          +{crossLinks.length}
        </Tooltip>
      ) : (
        <span>
          {crossLinks[0] && (
            <Link to={linkPrefix + crossLinks[0].id} target="_blank">
              {crossLinks[0].title}
            </Link>
          )}
        </span>
      )}
    </StyledCrossLinks>
  );
}
