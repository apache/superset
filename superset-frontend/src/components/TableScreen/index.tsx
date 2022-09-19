import React from 'react';
import { useTheme, styled } from '@superset-ui/core';
import Table, { TableProps } from 'src/components/Table';

export interface TableCardProps {
  tableProps: TableProps;
  title: string;
}

const Wrapper = styled('div')`
  border: 2px solid #ffcc00;
`;

export function TableScreen(props: TableCardProps) {
  const { tableProps, title, ...rest } = props;

  const theme = useTheme();

  return (
    <Wrapper>
      <span>{title}</span>
      <Table {...tableProps} />
    </Wrapper>
  );
}

export default TableScreen;
