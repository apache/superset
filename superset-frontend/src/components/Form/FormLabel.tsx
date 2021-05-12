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
import React, { ReactNode } from 'react';
import { styled } from '@superset-ui/core';

export type FormLabelProps = {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  required?: boolean;
  uppercase?: boolean;
};

const Label = styled.label<{ uppercase: boolean }>`
  text-transform: ${({ uppercase }) => (uppercase ? 'uppercase' : 'none')};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
`;

const RequiredLabel = styled.label<{ uppercase: boolean }>`
  text-transform: ${({ uppercase }) => (uppercase ? 'uppercase' : 'none')};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
  &::after {
    display: inline-block;
    color: ${({ theme }) => theme.colors.error.base};
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    content: '*';
  }
`;

export default function FormLabel({
  children,
  className,
  htmlFor,
  required = false,
  uppercase = true,
}: FormLabelProps) {
  const StyledLabel = required ? RequiredLabel : Label;
  return (
    <StyledLabel htmlFor={htmlFor} className={className} uppercase={uppercase}>
      {children}
    </StyledLabel>
  );
}
