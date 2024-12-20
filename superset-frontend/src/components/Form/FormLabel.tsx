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
import { styled } from '@superset-ui/core';

export type FormLabelProps = {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
};

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

const RequiredLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  &::after {
    display: inline-block;
    margin-left: ${({ theme }) => theme.sizeUnit}px;
    color: ${({ theme }) => theme.colorError};
    font-size: ${({ theme }) => theme.fontSize}px;
    content: '*';
  }
`;

export default function FormLabel({
  children,
  htmlFor,
  required = false,
  className,
}: FormLabelProps) {
  const StyledLabel = required ? RequiredLabel : Label;
  return (
    <StyledLabel htmlFor={htmlFor} className={className}>
      {children}
    </StyledLabel>
  );
}
