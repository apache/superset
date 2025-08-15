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
import { Collapse, CollapseLabelInModal } from '@superset-ui/core/components';
import { styled } from '@superset-ui/core';

interface CollapsibleModalSectionProps {
  sectionKey: string;
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  hasErrors?: boolean;
  testId?: string;
  children: ReactNode;
}

// Wrapper to ensure consistent spacing within sections
const SectionContent = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 2}px 0;
  `}
`;

export function CollapsibleModalSection({
  sectionKey,
  title,
  subtitle,
  defaultExpanded = false,
  hasErrors = false,
  testId,
  children,
}: CollapsibleModalSectionProps) {
  return (
    <Collapse.Panel
      key={sectionKey}
      header={
        <CollapseLabelInModal
          title={title}
          subtitle={subtitle}
          validateCheckStatus={!hasErrors}
          testId={testId}
        />
      }
    >
      <SectionContent>{children}</SectionContent>
    </Collapse.Panel>
  );
}

interface CollapsibleModalSectionsProps {
  defaultActiveKey?: string | string[];
  accordion?: boolean;
  children: ReactNode;
}

export function CollapsibleModalSections({
  defaultActiveKey = 'general',
  accordion = true,
  children,
}: CollapsibleModalSectionsProps) {
  return (
    <Collapse
      expandIconPosition="end"
      defaultActiveKey={defaultActiveKey}
      accordion={accordion}
      modalMode
    >
      {children}
    </Collapse>
  );
}
