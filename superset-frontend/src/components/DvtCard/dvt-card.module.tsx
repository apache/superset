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
import { styled } from '@superset-ui/core';

const StyledDvtCard = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px;
  height: 166px;
  width: 264px;
  flex-shrink: 0;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  border-radius: 12px;
  transition: 0.3s ease;

  &:hover {
    box-shadow: 0px 4px 4px ${({ theme }) => theme.colors.dvt.boxShadow.base};
  }
`;

const DvtCardHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DvtCardTitle = styled.div`
  color: ${({ theme }) => theme.colors.dvt.text.bold};
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0.2px;
  height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DvtHeadButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

interface IconButtonProps {
  fadeScale?: boolean;
}

const IconButton = styled.button<IconButtonProps>`
  display: flex;
  border: none;
  padding: 0;
  align-items: center;
  background-color: transparent;
  cursor: pointer;
  justify-content: space-between;
  transition: transform 0.2s ease;

  & .anticon {
    display: flex;
  }

  ${({ fadeScale }) =>
    fadeScale &&
    `&:hover {
    transform: scale(1.3);
  }`}
`;

const DvtCardLabel = styled.div`
  position: relative;
  color: ${({ theme }) => theme.colors.dvt.info.base};
  font-size: 12px;
  font-weight: 500;
  padding-left: 10px;
  margin: 10px 0;
  line-height: 12px;

  ::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: ${({ theme }) => theme.colors.dvt.info.base};
    transform: translateY(-50%);
  }
`;

const DvtCardDescription = styled.div`
  font-size: 12px;
  font-weight: 400;
  line-height: 160%;
  height: 57px;
  color: ${({ theme }) => theme.colors.dvt.text.label};
  word-break: break-all;
`;

const DvtCardLinkButton = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
`;

export {
  StyledDvtCard,
  DvtCardHead,
  DvtCardTitle,
  DvtHeadButtons,
  IconButton,
  DvtCardLabel,
  DvtCardDescription,
  DvtCardLinkButton,
};
