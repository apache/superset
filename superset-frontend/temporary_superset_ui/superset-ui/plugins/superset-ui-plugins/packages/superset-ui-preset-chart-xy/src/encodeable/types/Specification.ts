import { FieldDef } from './ChannelDef';

export interface BaseOptions {
  namespace?: string;
}

export interface PartialSpec<Encoding, Options extends BaseOptions = BaseOptions> {
  encoding: Partial<Encoding>;
  commonEncoding?: Partial<{
    group: FieldDef[];
    tooltip: FieldDef[];
  }>;
  options?: Options;
}

export interface FullSpec<Encoding, Options extends BaseOptions = BaseOptions> {
  encoding: Encoding;
  commonEncoding: {
    group: FieldDef[];
    tooltip: FieldDef[];
  };
  options?: Options;
}
