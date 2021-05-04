/// <reference types="@superset-ui/core/node_modules/@emotion/styled" />
import { styled, supersetTheme } from '@superset-ui/core';

export const PADDING = supersetTheme.gridUnit * 4;

export const RelativeDiv = styled.div`
  position: relative;
`;

export const ZoomControls = styled.div`
  position: absolute;
  top: ${PADDING}px;
  right: ${PADDING}px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

export const MiniMapControl = styled.div`
  position: absolute;
  bottom: ${PADDING + 6}px;
  right: ${PADDING + 1}px;
`;

export const IconButton = styled.button`
  width: ${({ theme }) => theme.gridUnit * 6}px;
  font-size: ${({ theme }) => theme.typography.sizes.xl}px;
  text-align: center;
  color: #222;
  margin: 0px;
  margin-bottom: 2px;
  background: #f5f8fb;
  padding: 0px ${({ theme }) => theme.gridUnit}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: none;
`;

export const TextButton = styled.button`
  text-align: center;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: #222;
  margin: 0px;
  background: #f5f8fb;
  padding: ${({ theme }) => theme.gridUnit / 2}px ${({ theme }) => theme.gridUnit * 1.5}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: none;
`;
