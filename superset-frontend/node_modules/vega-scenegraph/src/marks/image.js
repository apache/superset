import {visit} from '../util/visit';
import blend from '../util/canvas/blend';
import {pick} from '../util/canvas/pick';
import metadata from '../util/svg/metadata';
import {translate} from '../util/svg/transform';
import {truthy} from 'vega-util';

function getImage(item, renderer) {
  var image = item.image;
  if (!image || item.url && item.url !== image.url) {
    image = {complete: false, width: 0, height: 0};
    renderer.loadImage(item.url).then(image => {
      item.image = image;
      item.image.url = item.url;
    });
  }
  return image;
}

function imageWidth(item, image) {
  return item.width != null ? item.width
    : !image || !image.width ? 0
    : item.aspect !== false && item.height ? item.height * image.width / image.height
    : image.width;
}

function imageHeight(item, image) {
  return item.height != null ? item.height
    : !image || !image.height ? 0
    : item.aspect !== false && item.width ? item.width * image.height / image.width
    : image.height;
}

function imageXOffset(align, w) {
  return align === 'center' ? w / 2 : align === 'right' ? w : 0;
}

function imageYOffset(baseline, h) {
  return baseline === 'middle' ? h / 2 : baseline === 'bottom' ? h : 0;
}

function attr(emit, item, renderer) {
  const img = getImage(item, renderer),
        w = imageWidth(item, img),
        h = imageHeight(item, img),
        x = (item.x || 0) - imageXOffset(item.align, w),
        y = (item.y || 0) - imageYOffset(item.baseline, h),
        i = !img.src && img.toDataURL ? img.toDataURL() : img.src || '';

  emit('href', i, metadata['xmlns:xlink'], 'xlink:href');
  emit('transform', translate(x, y));
  emit('width', w);
  emit('height', h);
  emit('preserveAspectRatio', item.aspect === false ? 'none' : 'xMidYMid');
}

function bound(bounds, item) {
  const img = item.image,
        w = imageWidth(item, img),
        h = imageHeight(item, img),
        x = (item.x || 0) - imageXOffset(item.align, w),
        y = (item.y || 0) - imageYOffset(item.baseline, h);

  return bounds.set(x, y, x + w, y + h);
}

function draw(context, scene, bounds) {
  visit(scene, item => {
    if (bounds && !bounds.intersects(item.bounds)) return; // bounds check

    let img = getImage(item, this),
        w = imageWidth(item, img),
        h = imageHeight(item, img),
        x = (item.x || 0) - imageXOffset(item.align, w),
        y = (item.y || 0) - imageYOffset(item.baseline, h),
        opacity, ar0, ar1, t;

    if (item.aspect !== false) {
      ar0 = img.width / img.height;
      ar1 = item.width / item.height;
      if (ar0 === ar0 && ar1 === ar1 && ar0 !== ar1) {
        if (ar1 < ar0) {
          t = w / ar0;
          y += (h - t) / 2;
          h = t;
        } else {
          t = h * ar0;
          x += (w - t) / 2;
          w = t;
        }
      }
    }

    if (img.complete || img.toDataURL) {
      blend(context, item);
      context.globalAlpha = (opacity = item.opacity) != null ? opacity : 1;
      context.imageSmoothingEnabled = item.smooth !== false;
      context.drawImage(img, x, y, w, h);
    }
  });
}

export default {
  type:     'image',
  tag:      'image',
  nested:   false,
  attr:     attr,
  bound:    bound,
  draw:     draw,
  pick:     pick(),
  isect:    truthy, // bounds check is sufficient
  get:      getImage,
  xOffset:  imageXOffset,
  yOffset:  imageYOffset
};
