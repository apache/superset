// @flow

import { RGBAImage } from '../util/image';
import { register } from '../util/web_worker_transfer';
import potpack from 'potpack';

import type {StyleImage} from '../style/style_image';

const padding = 1;

type Rect = {
    x: number,
    y: number,
    w: number,
    h: number
};


export class ImagePosition {
    paddedRect: Rect;
    pixelRatio: number;

    constructor(paddedRect: Rect, {pixelRatio}: StyleImage) {
        this.paddedRect = paddedRect;
        this.pixelRatio = pixelRatio;
    }

    get tl(): [number, number] {
        return [
            this.paddedRect.x + padding,
            this.paddedRect.y + padding
        ];
    }

    get br(): [number, number] {
        return [
            this.paddedRect.x + this.paddedRect.w - padding,
            this.paddedRect.y + this.paddedRect.h - padding
        ];
    }

    get tlbr(): Array<number> {
        return this.tl.concat(this.br);
    }

    get displaySize(): [number, number] {
        return [
            (this.paddedRect.w - padding * 2) / this.pixelRatio,
            (this.paddedRect.h - padding * 2) / this.pixelRatio
        ];
    }
}

export default class ImageAtlas {
    image: RGBAImage;
    iconPositions: {[string]: ImagePosition};
    patternPositions: {[string]: ImagePosition};
    uploaded: ?boolean;

    constructor(icons: {[string]: StyleImage}, patterns: {[string]: StyleImage}) {
        const iconPositions = {}, patternPositions = {};

        const bins = [];
        for (const id in icons) {
            const src = icons[id];
            const bin = {
                x: 0,
                y: 0,
                w: src.data.width + 2 * padding,
                h: src.data.height + 2 * padding,
            };
            bins.push(bin);
            iconPositions[id] = new ImagePosition(bin, src);
        }

        for (const id in patterns) {
            const src = patterns[id];
            const bin = {
                x: 0,
                y: 0,
                w: src.data.width + 2 * padding,
                h: src.data.height + 2 * padding,
            };
            bins.push(bin);
            patternPositions[id] = new ImagePosition(bin, src);
        }

        const {w, h} = potpack(bins);
        const image = new RGBAImage({width: w || 1, height: h || 1});

        for (const id in icons) {
            const src = icons[id];
            const bin = iconPositions[id].paddedRect;
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x: bin.x + padding, y: bin.y + padding}, src.data);
        }

        for (const id in patterns) {
            const src = patterns[id];
            const bin = patternPositions[id].paddedRect;
            const x = bin.x + padding,
                y = bin.y + padding,
                w = src.data.width,
                h = src.data.height;

            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x, y}, src.data);
            // Add 1 pixel wrapped padding on each side of the image.
            RGBAImage.copy(src.data, image, { x: 0, y: h - 1 }, { x, y: y - 1 }, { width: w, height: 1 }); // T
            RGBAImage.copy(src.data, image, { x: 0, y:     0 }, { x, y: y + h }, { width: w, height: 1 }); // B
            RGBAImage.copy(src.data, image, { x: w - 1, y: 0 }, { x: x - 1, y }, { width: 1, height: h }); // L
            RGBAImage.copy(src.data, image, { x: 0,     y: 0 }, { x: x + w, y }, { width: 1, height: h }); // R
        }

        this.image = image;
        this.iconPositions = iconPositions;
        this.patternPositions = patternPositions;
    }
}

register('ImagePosition', ImagePosition);
register('ImageAtlas', ImageAtlas);

