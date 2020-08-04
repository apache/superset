// Type definitions for dom-to-image 2.6
// Project: https://github.com/tsayen/dom-to-image
// Definitions by: Jip Sterk <https://github.com/JipSterk>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.2

/// <reference types="node" />

export interface DomToImage {
  toSvg(node: Node, options?: Options): Promise<string>;
  toPng(node: Node, options?: Options): Promise<string>;
  toJpeg(node: Node, options?: Options): Promise<string>;
  toBlob(node: Node, options?: Options): Promise<Blob>;
  toPixelData(node: Node, options?: Options): Promise<string>;
}

export interface Options {
  filter?: (node: Node) => boolean;
  bgcolor?: string;
  width?: number;
  height?: number;
  style?: {};
  quality?: number;
  imagePlaceholder?: string;
  cachebust?: boolean;
}

export const DomToImage: DomToImage;

type DomToImage_ = DomToImage;
type Options_ = Options;

export default DomToImage;

declare global {
  namespace DomToImage {
    type Options = Options_;
    type DomToImage = DomToImage_;
  }

  const DomToImage: DomToImage.DomToImage;
}
