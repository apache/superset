// eslint-disable-next-line import/prefer-default-export
export type ObjectWithKeysFromAndValueType<T extends {}, V> = { [key in keyof T]: V };
