// @flow

import window from '../util/window';
const { HTMLImageElement, HTMLCanvasElement, HTMLVideoElement, ImageData } = window;

import type Context from '../gl/context';
import type {RGBAImage, AlphaImage} from '../util/image';

export type TextureFormat =
    | $PropertyType<WebGLRenderingContext, 'RGBA'>
    | $PropertyType<WebGLRenderingContext, 'ALPHA'>;
export type TextureFilter =
    | $PropertyType<WebGLRenderingContext, 'LINEAR'>
    | $PropertyType<WebGLRenderingContext, 'LINEAR_MIPMAP_NEAREST'>
    | $PropertyType<WebGLRenderingContext, 'NEAREST'>;
export type TextureWrap =
    | $PropertyType<WebGLRenderingContext, 'REPEAT'>
    | $PropertyType<WebGLRenderingContext, 'CLAMP_TO_EDGE'>
    | $PropertyType<WebGLRenderingContext, 'MIRRORED_REPEAT'>;

type EmptyImage = {
    width: number,
    height: number,
    data: null
}

export type TextureImage =
    | RGBAImage
    | AlphaImage
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | ImageData
    | EmptyImage;

class Texture {
    context: Context;
    size: [number, number];
    texture: WebGLTexture;
    format: TextureFormat;
    filter: ?TextureFilter;
    wrap: ?TextureWrap;
    useMipmap: boolean;

    constructor(context: Context, image: TextureImage, format: TextureFormat, options: ?{ premultiply?: boolean, useMipmap?: boolean }) {
        this.context = context;
        this.format = format;
        this.texture = context.gl.createTexture();
        this.update(image, options);
    }

    update(image: TextureImage, options: ?{premultiply?: boolean, useMipmap?: boolean}) {
        const {width, height} = image;
        const resize = !this.size || this.size[0] !== width || this.size[1] !== height;
        const {context} = this;
        const {gl} = context;

        this.useMipmap = Boolean(options && options.useMipmap);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        context.pixelStoreUnpackFlipY.set(false);
        context.pixelStoreUnpack.set(1);
        context.pixelStoreUnpackPremultiplyAlpha.set(this.format === gl.RGBA && (!options || options.premultiply !== false));

        if (resize) {
            this.size = [width, height];

            if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof HTMLVideoElement || image instanceof ImageData) {
                gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, gl.UNSIGNED_BYTE, image);
            } else {
                gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, gl.UNSIGNED_BYTE, image.data);
            }

        } else {
            if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof HTMLVideoElement || image instanceof ImageData) {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);
            } else {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
            }
        }

        if (this.useMipmap && this.isSizePowerOfTwo()) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
    }

    bind(filter: TextureFilter, wrap: TextureWrap, minFilter: ?TextureFilter) {
        const {context} = this;
        const {gl} = context;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (minFilter === gl.LINEAR_MIPMAP_NEAREST && !this.isSizePowerOfTwo()) {
            minFilter = gl.LINEAR;
        }

        if (filter !== this.filter) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter || filter);
            this.filter = filter;
        }

        if (wrap !== this.wrap) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
            this.wrap = wrap;
        }
    }

    isSizePowerOfTwo() {
        return this.size[0] === this.size[1] && (Math.log(this.size[0]) / Math.LN2) % 1 === 0;
    }

    destroy() {
        const {gl} = this.context;
        gl.deleteTexture(this.texture);
        this.texture = (null: any);
    }
}

export default Texture;
