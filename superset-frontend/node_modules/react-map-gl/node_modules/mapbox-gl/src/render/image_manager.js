// @flow

import potpack from 'potpack';

import { Event, Evented } from '../util/evented';
import { RGBAImage } from '../util/image';
import { ImagePosition } from './image_atlas';
import Texture from './texture';
import assert from 'assert';
import {renderStyleImage} from '../style/style_image';
import { warnOnce } from '../util/util';

import type {StyleImage} from '../style/style_image';
import type Context from '../gl/context';
import type {Bin} from 'potpack';
import type {Callback} from '../types/callback';

type Pattern = {
    bin: Bin,
    position: ImagePosition
};

// When copied into the atlas texture, image data is padded by one pixel on each side. Icon
// images are padded with fully transparent pixels, while pattern images are padded with a
// copy of the image data wrapped from the opposite side. In both cases, this ensures the
// correct behavior of GL_LINEAR texture sampling mode.
const padding = 1;

/*
    ImageManager does three things:

        1. Tracks requests for icon images from tile workers and sends responses when the requests are fulfilled.
        2. Builds a texture atlas for pattern images.
        3. Rerenders renderable images once per frame

    These are disparate responsibilities and should eventually be handled by different classes. When we implement
    data-driven support for `*-pattern`, we'll likely use per-bucket pattern atlases, and that would be a good time
    to refactor this.
*/
class ImageManager extends Evented {
    images: {[string]: StyleImage};
    updatedImages: {[string]: boolean};
    callbackDispatchedThisFrame: {[string]: boolean};
    loaded: boolean;
    requestors: Array<{ids: Array<string>, callback: Callback<{[string]: StyleImage}>}>;

    patterns: {[string]: Pattern};
    atlasImage: RGBAImage;
    atlasTexture: ?Texture;
    dirty: boolean;

    constructor() {
        super();
        this.images = {};
        this.updatedImages = {};
        this.callbackDispatchedThisFrame = {};
        this.loaded = false;
        this.requestors = [];

        this.patterns = {};
        this.atlasImage = new RGBAImage({width: 1, height: 1});
        this.dirty = true;
    }

    isLoaded() {
        return this.loaded;
    }

    setLoaded(loaded: boolean) {
        if (this.loaded === loaded) {
            return;
        }

        this.loaded = loaded;

        if (loaded) {
            for (const {ids, callback} of this.requestors) {
                this._notify(ids, callback);
            }
            this.requestors = [];
        }
    }

    getImage(id: string): ?StyleImage {
        return this.images[id];
    }

    addImage(id: string, image: StyleImage) {
        assert(!this.images[id]);
        this.images[id] = image;
    }

    updateImage(id: string, image: StyleImage) {
        const oldImage = this.images[id];
        assert(oldImage);
        assert(oldImage.data.width === image.data.width);
        assert(oldImage.data.height === image.data.height);
        image.version = oldImage.version + 1;
        this.images[id] = image;
        this.updatedImages[id] = true;
    }

    removeImage(id: string) {
        assert(this.images[id]);
        const image = this.images[id];
        delete this.images[id];
        delete this.patterns[id];

        if (image.userImage && image.userImage.onRemove) {
            image.userImage.onRemove();
        }
    }

    listImages(): Array<string> {
        return Object.keys(this.images);
    }

    getImages(ids: Array<string>, callback: Callback<{[string]: StyleImage}>) {
        // If the sprite has been loaded, or if all the icon dependencies are already present
        // (i.e. if they've been addeded via runtime styling), then notify the requestor immediately.
        // Otherwise, delay notification until the sprite is loaded. At that point, if any of the
        // dependencies are still unavailable, we'll just assume they are permanently missing.
        let hasAllDependencies = true;
        if (!this.isLoaded()) {
            for (const id of ids) {
                if (!this.images[id]) {
                    hasAllDependencies = false;
                }
            }
        }
        if (this.isLoaded() || hasAllDependencies) {
            this._notify(ids, callback);
        } else {
            this.requestors.push({ids, callback});
        }
    }

    _notify(ids: Array<string>, callback: Callback<{[string]: StyleImage}>) {
        const response = {};

        for (const id of ids) {
            if (!this.images[id]) {
                this.fire(new Event('styleimagemissing', { id }));
            }
            const image = this.images[id];
            if (image) {
                // Clone the image so that our own copy of its ArrayBuffer doesn't get transferred.
                response[id] = {
                    data: image.data.clone(),
                    pixelRatio: image.pixelRatio,
                    sdf: image.sdf,
                    version: image.version,
                    hasRenderCallback: Boolean(image.userImage && image.userImage.render)
                };
            } else {
                warnOnce(`Image "${id}" could not be loaded. Please make sure you have added the image with map.addImage() or a "sprite" property in your style. You can provide missing images by listening for the "styleimagemissing" map event.`);
            }
        }

        callback(null, response);
    }

    // Pattern stuff

    getPixelSize() {
        const {width, height} = this.atlasImage;
        return {width, height};
    }

    getPattern(id: string): ?ImagePosition {
        const pattern = this.patterns[id];

        const image = this.getImage(id);
        if (!image) {
            return null;
        }

        if (pattern && pattern.position.version === image.version) {
            return pattern.position;
        }

        if (!pattern) {
            const w = image.data.width + padding * 2;
            const h = image.data.height + padding * 2;
            const bin = {w, h, x: 0, y: 0};
            const position = new ImagePosition(bin, image);
            this.patterns[id] = {bin, position};
        } else {
            pattern.position.version = image.version;
        }

        this._updatePatternAtlas();

        return this.patterns[id].position;
    }

    bind(context: Context) {
        const gl = context.gl;
        if (!this.atlasTexture) {
            this.atlasTexture = new Texture(context, this.atlasImage, gl.RGBA);
        } else if (this.dirty) {
            this.atlasTexture.update(this.atlasImage);
            this.dirty = false;
        }

        this.atlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }

    _updatePatternAtlas() {
        const bins = [];
        for (const id in this.patterns) {
            bins.push(this.patterns[id].bin);
        }

        const {w, h} = potpack(bins);

        const dst = this.atlasImage;
        dst.resize({width: w || 1, height: h || 1});

        for (const id in this.patterns) {
            const {bin} = this.patterns[id];
            const x = bin.x + padding;
            const y = bin.y + padding;
            const src = this.images[id].data;
            const w = src.width;
            const h = src.height;

            RGBAImage.copy(src, dst, { x: 0, y: 0 }, { x, y }, { width: w, height: h });

            // Add 1 pixel wrapped padding on each side of the image.
            RGBAImage.copy(src, dst, { x: 0, y: h - 1 }, { x, y: y - 1 }, { width: w, height: 1 }); // T
            RGBAImage.copy(src, dst, { x: 0, y:     0 }, { x, y: y + h }, { width: w, height: 1 }); // B
            RGBAImage.copy(src, dst, { x: w - 1, y: 0 }, { x: x - 1, y }, { width: 1, height: h }); // L
            RGBAImage.copy(src, dst, { x: 0,     y: 0 }, { x: x + w, y }, { width: 1, height: h }); // R
        }

        this.dirty = true;
    }

    beginFrame() {
        this.callbackDispatchedThisFrame = {};
    }

    dispatchRenderCallbacks(ids: Array<string>) {
        for (const id of ids) {

            // the callback for the image was already dispatched for a different frame
            if (this.callbackDispatchedThisFrame[id]) continue;
            this.callbackDispatchedThisFrame[id] = true;

            const image = this.images[id];
            assert(image);

            const updated = renderStyleImage(image);
            if (updated) {
                this.updateImage(id, image);
            }
        }
    }
}

export default ImageManager;
