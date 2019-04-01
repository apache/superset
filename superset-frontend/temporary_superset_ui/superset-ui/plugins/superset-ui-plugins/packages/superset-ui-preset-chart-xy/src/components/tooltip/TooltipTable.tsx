import React, { CSSProperties, PureComponent, ReactNode } from 'react';

type Props = {
  className?: string;
  data: {
    key: string | number;
    keyColumn: ReactNode;
    keyStyle?: CSSProperties;
    valueColumn: ReactNode;
    valueStyle?: CSSProperties;
  }[];
};

const VALUE_CELL_STYLE: CSSProperties = { paddingLeft: 8, textAlign: 'right' };

export default class TooltipTable extends PureComponent<Props, {}> {
  static defaultProps = {
    className: '',
    data: [],
  };

  render() {
    const { className, data } = this.props;

    return (
      <table className={className}>
        <tbody>
          {data.map(({ key, keyColumn, keyStyle, valueColumn, valueStyle }, i) => (
            <tr key={key}>
              <td style={keyStyle}>{keyColumn}</td>
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
