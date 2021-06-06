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
import { styled } from '@superset-ui/core';
import Button from 'src/components/Button';
import { ButtonProps as AntdButtonProps } from 'antd/lib/button';

export interface IconButtonProps extends AntdButtonProps {
  buttonText: string;
  icon: string;
  altText?: string;
}

const StyledButton = styled(Button)`
  height: auto;
  display: flex;
  flex-direction: column;
  padding: 0;
`;
const StyledImage = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 8}px 0;
  padding: ${({ theme }) => theme.gridUnit * 4}px;

  &:first-of-type {
    margin-right: 0;
  }

  img {
    width: fit-content;

    &:first-of-type {
      margin-right: 0;
    }
  }
`;

const StyledInner = styled.div`
  max-height: calc(1.5em * 2);
  overflow: hidden;
  padding-right: 1rem;
  position: relative;
  white-space: break-spaces;

  &::before {
    content: '...';
    inset-block-end: 0; /* "bottom" */
    inset-inline-end: 8px; /* "right" */
    position: absolute;
  }

  &::after {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    content: '';
    height: 1rem;
    inset-inline-end: 8px; /* "right" */
    position: absolute;
    top: 4px;
    width: 1rem;
  }
`;

const StyledBottom = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 6}px
    ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: 0 0 ${({ theme }) => theme.borderRadius}px
    ${({ theme }) => theme.borderRadius}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
  width: 100%;
  line-height: 1.5em;
  overflow: hidden;
  white-space: no-wrap;
  text-overflow: ellipsis;

  &:first-of-type {
    margin-right: 0;
  }
`;

const IconButton = styled(
  ({ icon, altText, buttonText, ...props }: IconButtonProps) => (
    <StyledButton {...props}>
      <StyledImage>
        <img src={icon} alt={altText} />
      </StyledImage>
      <StyledBottom>
        <StyledInner>{buttonText}</StyledInner>
      </StyledBottom>
    </StyledButton>
  ),
)`
  text-transform: none;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  font-weight: ${({ theme }) => theme.typography.weights.normal};
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  margin: 0;
  width: 100%;

  &:hover,
  &:focus {
    background-color: ${({ theme }) => theme.colors.grayscale.light5};
    color: ${({ theme }) => theme.colors.grayscale.dark2};
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
`;

export default IconButton;
