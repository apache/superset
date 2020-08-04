declare module "json-stringify-pretty-compact" {
  const stringify: (
    object: any,
    options?: {
      indent?: number | string;
      maxLength?: number;
      replacer?:
        | ((key: string, value: any) => any)
        | (number | string)[]
        | null;
    }
  ) => string;
  export = stringify;
}
