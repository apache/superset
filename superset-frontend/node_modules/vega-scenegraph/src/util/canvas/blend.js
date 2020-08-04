export default function(context, item) {
  context.globalCompositeOperation = item.blend || 'source-over';
}
