/* eslint-disable theme-colors/no-literal-colors */
// DODO was here

import React from 'react';
import { styled } from '@superset-ui/core';
import cls from 'classnames';
import Loader from 'src/assets/images/loading.gif';

export type PositionOption =
  | 'floating'
  | 'inline'
  | 'inline-centered'
  | 'normal';
export interface Props {
  position?: PositionOption;
  className?: string;
  image?: string;
}

const LoaderDiv = styled.div`
  z-index: 99;
  width: 50px;
  position: relative;
  margin: 10px;
  &.inline {
    margin: 0px;
    width: 30px;
  }
  &.inline-centered {
    margin: 0 auto;
    width: 30px;
    display: block;
  }
  &.floating {
    padding: 0;
    margin: 0;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }
`;

const LdsRing = styled.div`
  display: flex;
  position: relative;
  width: 40px;
  height: 40px;

  div {
    position: absolute;
    top: 15px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff6900;
    animation-timing-function: cubic-bezier(0, 1, 1, 0);
  }
  div:nth-child(1) {
    left: 4px;
    animation: lds-ellipsis1 0.6s infinite;
  }
  div:nth-child(2) {
    left: 4px;
    animation: lds-ellipsis2 0.6s infinite;
  }
  div:nth-child(3) {
    left: 16px;
    animation: lds-ellipsis2 0.6s infinite;
  }
  div:nth-child(4) {
    left: 28px;
    animation: lds-ellipsis3 0.6s infinite;
  }
  @keyframes lds-ellipsis1 {
    0% {
      transform: scale(0);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes lds-ellipsis3 {
    0% {
      transform: scale(1);
    }
    100% {
      transform: scale(0);
    }
  }
  @keyframes lds-ellipsis2 {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(12px, 0);
    }
  }
`;

export default function Loading({ position = 'floating', className }: Props) {
  return (
    <LoaderDiv className={cls('loading', position, className)}>
      <LdsRing>
        <div />
        <div />
        <div />
        <div />
      </LdsRing>
    </LoaderDiv>
  );
}
