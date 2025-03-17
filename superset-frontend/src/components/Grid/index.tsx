import { Row, Col } from 'antd-v5';
import useBreakpoint from 'antd-v5/es/grid/hooks/useBreakpoint';
import type { ColProps, ColSize } from 'antd-v5/es/col';
import type { RowProps } from 'antd-v5/es/row';

export type { ColProps, ColSize, RowProps };

export { Row, Col };

const Grid = { useBreakpoint };
export default Grid;
