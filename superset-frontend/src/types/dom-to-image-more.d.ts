declare module 'dom-to-image-more' {
  export interface Options {
    filter?: ((node: Node) => boolean) | undefined;
    bgcolor?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    style?: {} | undefined;
    quality?: number | undefined;
    imagePlaceholder?: string | undefined;
    cacheBust?: boolean | undefined;
  }

  class DomToImageMore {
    static toJpeg(node: Node, options?: Options): Promise<string>;
  }

  export default DomToImageMore;
}
