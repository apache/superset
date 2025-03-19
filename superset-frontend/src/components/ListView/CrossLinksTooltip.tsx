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
import { ReactNode } from 'react';
import { styled, t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { Link } from 'react-router-dom';

export type CrossLinksTooltipProps = {
  children: ReactNode;
  crossLinks: { to: string; title: string }[];
  moreItems?: number;
  show: boolean;
};

const StyledLinkedTooltip = styled.div`
  .link {
    color: ${({ theme }) => theme.colors.grayscale.light5};
    display: block;
    text-decoration: underline;
  }
`;

export default function CrossLinksTooltip({
  children,
  crossLinks = [],
  moreItems = undefined,
  show = false,
}: CrossLinksTooltipProps) {
  return (
    <Tooltip
      placement="top"
      data-test="crosslinks-tooltip"
      title={
        show && (
          <StyledLinkedTooltip>
            {crossLinks.map(link => (
              <Link
                className="link"
                key={link.to}
                to={link.to}
                target="_blank"
                rel="noreferer noopener"
              >
                {link.title}
              </Link>
            ))}
            {moreItems && (
              <span data-test="plus-more">{t('+ %s more', moreItems)}</span>
            )}
          </StyledLinkedTooltip>
        )
      }
    >
      {children}
    </Tooltip>
  );
}
