export interface BaseOptions {
  namespace?: string;
}

export interface PartialSpec<Encoding, Options extends BaseOptions = BaseOptions> {
  encoding: Partial<Encoding>;
  options?: Options;
}

export interface FullSpec<Encoding, Options extends BaseOptions = BaseOptions> {
  encoding: Encoding;
  options?: Options;
}
