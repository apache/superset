import React from 'react';
import { Dropdown as AntdDropdown } from 'src/common/components';
import { css } from '@emotion/core';
import { styled } from '@superset-ui/core';

const dotStyle = css`
  width: 3px;
  height: 3px;
  border-radius: 1.5px;
  background-color: #bababa;

  &:hover {
    background-color: #20a7c9;
  }
`;

const MenuDots = styled.div`
  ${dotStyle};
  font-weight: 400;
  display: inline-flex;

  &::before,
  &::after {
    position: absolute;
    content: ' ';
    ${dotStyle};
  }

  &::before {
    transform: translateY(-5px);
  }

  &::after {
    transform: translateY(5px);
  }
`;

const MenuDotsWrapper = styled.div`
  display: flex;
  align-items: center;
  padding-right: 8px;
`;

export const Dropdown = ({ overlay, ...rest }) => (
  <AntdDropdown overlay={overlay} {...rest}>
    <MenuDotsWrapper>
      <MenuDots />
    </MenuDotsWrapper>
  </AntdDropdown>
);
