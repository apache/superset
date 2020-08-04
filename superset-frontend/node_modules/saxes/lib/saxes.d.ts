declare namespace saxes {
  export const EVENTS: ReadonlyArray<string>;

  export interface SaxesOptions {
    xmlns?: boolean;
    position?: boolean;
    fragment?: boolean;
    fileName?: string;
    additionalNamespaces?: Record<string, string>;
  }

  export interface XMLDecl {
    version?: string;
    encoding?: string;
    standalone?: string;
  }

  export interface SaxesAttribute {
    name: string;
    prefix: string;
    local: string;
    uri: string;
    value: string;
  }

  export interface SaxesTag {
    name: string;
    prefix: string;
    local: string;
    uri: string;
    attributes: Record<string, SaxesAttribute> | Record<string, string>;
    ns: Record<string, string>;
    isSelfClosing: boolean;
  }

  export class SaxesParser {
    constructor(opt: SaxesOptions);

    readonly opt: SaxesOptions;
    readonly closed: boolean;
    readonly xmlDecl: XMLDecl;
    readonly line: number;
    readonly column: number;
    readonly position: number;
    readonly ENTITIES: Record<string, string>;

    ontext(text: string): void;
    onprocessinginstruction(pi: { target: string, body: string }): void;
    ondoctype(doctype: string): void;
    oncomment(comment: string): void;
    onopentagstart(tag: SaxesTag): void;
    onopentag(tag: SaxesTag): void;
    onclosetag(tag: SaxesTag): void;
    oncdata(cdata: string): void;
    onend(): void;
    onready(): void;
    onerror(err: Error): void;

    fail(er: Error): this;
    write(chunk: string | null): this;
    close(): this;

    resolve(prefix: string): string | undefined;
  }
}

export = saxes;
