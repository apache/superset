import React, { CSSProperties, PureComponent, ReactNode } from 'react';

interface TooltipRowData {
  key: string | number;
  keyColumn?: ReactNode;
  keyStyle?: CSSProperties;
  valueColumn: ReactNode;
  valueStyle?: CSSProperties;
}

const defaultProps = {
  className: '',
  data: [] as TooltipRowData[],
};

type Props = {
  className?: string;
  data: TooltipRowData[];
} & Readonly<typeof defaultProps>;

const VALUE_CELL_STYLE: CSSProperties = { paddingLeft: 8, textAlign: 'right' };

export default class TooltipTable extends PureComponent<Props, {}> {
  static defaultProps = defaultProps;

  render() {
    const { className, data } = this.props;

    return (
      <table className={className}>
        <tbody>
          {data.map(({ key, keyColumn, keyStyle, valueColumn, valueStyle }) => (
            <tr key={key}>
              <td style={keyStyle}>{keyColumn ?? key}</td>
              <td style={valueStyle ? { ...VALUE_CELL_STYLE, ...valueStyle } : VALUE_CELL_STYLE}>
                {valueColumn}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}
