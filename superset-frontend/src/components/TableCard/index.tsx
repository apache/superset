import React, { useState } from 'react';
import { Table as AntTable } from 'antd';
// import { css } from '@emotion/react';
import { useTheme, styled } from '@superset-ui/core';
import Table, { TableProps } from 'src/components/Table';

export interface TableCardProps {
  tableProps: TableProps;
  title: string;
}

const Wrapper = styled('div')`
  border: 2px solid #ffcc00;
`;

export function TableCard(props: TableCardProps) {
  const { tableProps, title, ...rest } = props;

  const theme = useTheme();

  return (
    <Wrapper>
      <span>{title}</span>
      <Table {...tableProps} />
    </Wrapper>
  );
}

export default TableCard;
