
declare namespace Jimp {
    type ImageCallback = (err: Error|null, image: Jimp) => any;

    interface RGB {
        r: number;
        g: number;
        b: number;
    }
    interface RGBA {
        r: number;
        g: number;
        b: number;
        a: number;
    }

    interface Jimp {
        bitmap: {data: Buffer, width: number, height: number};

        clone(cb?: Jimp.ImageCallback): Jimp;
        quality(n: number, cb?: Jimp.ImageCallback): this;
        deflateLevel(l: number, cb?: Jimp.ImageCallback): this;
        deflateStrategy(s: number, cb?: Jimp.ImageCallback): this;
        filterType(f: number, cb?: Jimp.ImageCallback): this;

        rgba(bool: boolean, cb?: Jimp.ImageCallback): this;
        background(hex: number, cb?: Jimp.ImageCallback): this;
        scan(x: number, y: number, w: number, h: number, f: (x:number, y:number, idx:number)=>any, cb?: Jimp.ImageCallback): this;
        getMIME(): string;
        getExtension(): string;
        getPixelIndex(x: number, y: number, cb?: (err:Error, i:number)=>any): number;
        getPixelColor(x: number, y: number, cb?: (err:Error, hex:number)=>any): number;
        setPixelColor(hex: number, x: number, y: number, cb?: Jimp.ImageCallback): this;
        hash(base?: number, cb?: (err:Error, hash: string)=>any): string;
        crop(x: number, y: number, w: number, h: number, cb?: Jimp.ImageCallback): this;
        autocrop(tolerance?: number, cropOnlyFrames?: boolean, cb?: Jimp.ImageCallback): this
        blit(src: Jimp, x: number, y: number, srcx?: number, srcy?: number, srcw?: number, srch?: number, cb?: Jimp.ImageCallback): this
        mask(src: Jimp, x: number, y: number, cb?: Jimp.ImageCallback): this
        composite(src: Jimp, x: number, y: number, cb?: Jimp.ImageCallback): this;
        brightness(val: number, cb?: Jimp.ImageCallback): this;
        contrast(val: number, cb?: Jimp.ImageCallback): this;
        posterize(n: number, cb?: Jimp.ImageCallback): this;
        histogram(): {r: number[], g: number[], b: number[]};
        normalize(cb?: Jimp.ImageCallback): this;
        invert(cb?: Jimp.ImageCallback): this;
        mirror(horizontal: boolean, vertical: boolean, cb?: Jimp.ImageCallback): this;
        gaussian(r: number, cb?: Jimp.ImageCallback): this;
        blur(r: number, cb?: Jimp.ImageCallback): this;

        greyscale(cb?: Jimp.ImageCallback): this;
        grayscale(cb?: Jimp.ImageCallback): this;
        sepia(cb?: Jimp.ImageCallback): this;
        opacity(f: any, cb?: any):this;
        fade(f: any, cb?: any): this;
        opaque(cb: any): this;
        resize(w: number, h: number, mode?: string, cb?: Jimp.ImageCallback): this;
        cover(w: number, h: number, alignBits?: number, mode?: string, cb?: Jimp.ImageCallback): this;
        contain(w: number, h: number, alignBits?: number, mode?: string, cb?: Jimp.ImageCallback): this;
        scale(f: number, mode?: string, cb?: Jimp.ImageCallback): this;
        scaleToFit(w: number, h: number, mode?: any, cb?: Jimp.ImageCallback): this;
        rotate(deg: number, mode?: number|boolean, cb?: Jimp.ImageCallback): this;
        getBuffer(mime: string, cb:(err:Error, buffer:Buffer)=>any): this;

        write(path: string, cb?: Jimp.ImageCallback): this;
    }

    var Jimp: {

        // used to auto resizing etc.
        AUTO: number;

        // supported mime types
        MIME_PNG: string;
        MIME_JPEG: string;
        MIME_BMP: string;

        // PNG filter types
        PNG_FILTER_AUTO: number;
        PNG_FILTER_NONE: number;
        PNG_FILTER_SUB: number;
        PNG_FILTER_UP: number;
        PNG_FILTER_AVERAGE: number;
        PNG_FILTER_PAETH: number;

        // resize methods
        RESIZE_NEAREST_NEIGHBOR: string;
        RESIZE_BILINEAR: string;
        RESIZE_BICUBIC: string;
        RESIZE_HERMITE: string;
        RESIZE_BEZIER: string;

        // Align modes for cover, contain, bit masks
        HORIZONTAL_ALIGN_LEFT: number;
        HORIZONTAL_ALIGN_CENTER: number;
        HORIZONTAL_ALIGN_RIGHT: number;

        VERTICAL_ALIGN_TOP: number;
        VERTICAL_ALIGN_MIDDLE: number;
        VERTICAL_ALIGN_BOTTOM: number;

        // Font locations
        FONT_SANS_8_BLACK: string;
        FONT_SANS_16_BLACK: string;
        FONT_SANS_32_BLACK: string;
        FONT_SANS_64_BLACK: string;
        FONT_SANS_128_BLACK: string;

        FONT_SANS_8_WHITE: string;
        FONT_SANS_16_WHITE: string;
        FONT_SANS_32_WHITE: string;
        FONT_SANS_64_WHITE: string;
        FONT_SANS_128_WHITE: string;

        (path: string, cb?: Jimp.ImageCallback): Jimp;
        (image: Jimp, cb?: Jimp.ImageCallback): Jimp;
        (data: Buffer, cb?: Jimp.ImageCallback): Jimp;
        (w: number, h: number, cb?: Jimp.ImageCallback): Jimp;

        read(src: string|Buffer, cb?: Jimp.ImageCallback): Promise<Jimp>;

        rgbaToInt(r: number, g: number, b: number, a: number, cb?: (err: Error, i: number)=>any): number;
        intToRgba(i: number, cb?: (err:Error, rgba: Jimp.RGBA)=>any): Jimp.RGBA;
        limit255(n: number): number;
        diff(img1: Jimp, img2: Jimp, threshold?: number): {percent: number, diff: Jimp};
        distance(img1: Jimp, img2: Jimp): number;

        prototype: Jimp;
    };
}

declare module "jimp" {
    export = Jimp.Jimp;
}