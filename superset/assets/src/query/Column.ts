export enum ColumnType {
  DOUBLE = 'DOUBLE',
  FLOAT = 'FLOAT',
  INT = 'INT',
  BIGINT = 'BIGINT',
  LONG = 'LONG',
  REAL = 'REAL',
  NUMERIC = 'NUMERIC',
  DECIMAL = 'DECIMAL',
  MONEY = 'MONEY',
  DATE = 'DATE',
  TIME = 'TIME',
  DATETIME = 'DATETIME',
  VARCHAR = 'VARCHAR',
  STRING = 'STRING',
  CHAR = 'CHAR',
}

// TODO: fill out additional fields of the Column interface
export default interface Column {
  id: number;
  type: ColumnType;
  columnName: string;
}
