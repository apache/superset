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

interface StyledModalProps {
  size: 'small' | 'medium';
}

const StyledModal = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${({ theme }) => theme.colors.dvt.backgroundColor.opacity};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
`;
const StyledModalCard = styled.div<StyledModalProps>`
  position: relative;
  border-radius: 12px;
  width: ${({ size }) => (size === 'small' ? '919px' : '1150.68px')};
  height: ${({ size }) => (size === 'small' ? '683px' : '621.428px')};
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;
const StyledModalCardClose = styled.div`
  content: '';
  position: absolute;
  top: 23px;
  right: 43.63px;
  cursor: pointer;
  opacity: 0.7;
  transition: all 300ms;
`;
const StyledModalCardTitle = styled.div`
  background: ${({ theme }) => theme.colors.dvt.grayscale.light2};
  border-radius: 12px;
  padding: 16px 27px;
  width: 100%;
  height: 60px;
`;
const StyledModalCardBody = styled.div``;

export {
  StyledModal,
  StyledModalCard,
  StyledModalCardClose,
  StyledModalCardTitle,
  StyledModalCardBody,
};
