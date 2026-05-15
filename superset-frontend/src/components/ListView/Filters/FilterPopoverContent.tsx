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
import type { ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled, css } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';

interface FilterPopoverContentProps {
  children: ReactNode;
  /** Injected by CompactFilterTrigger via cloneElement */
  onClose?: () => void;
  /** Injected by CompactFilterTrigger via cloneElement — unused but accepted to avoid React unknown-prop warnings */
  isOpen?: boolean;
}

const Wrapper = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 2}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;

    /* Hide the redundant label inside the popover — the pill already shows it */
    label {
      display: none;
    }
  `}
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export default function FilterPopoverContent({
  children,
  onClose,
}: FilterPopoverContentProps) {
  return (
    <Wrapper>
      {children}
      <Footer>
        <Button size="small" buttonStyle="primary" onClick={onClose}>
          {t('Apply')}
        </Button>
      </Footer>
    </Wrapper>
  );
}
