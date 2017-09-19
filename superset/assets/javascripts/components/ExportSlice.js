/* eslint camelcase: 0 */

export function hasSvg(slice) {
  return !['table', 'filter_box'].includes(slice.form_data.viz_type);
}

export function exportSlice(slice, format) {
  if (format === 'png') {
    const tmp = document.getElementById('con_' + slice.slice_id);
    const svg = tmp.getElementsByTagName('svg')[0];
    const svg_xml = (new XMLSerializer()).serializeToString(svg);
    const data_uri = 'data:image/svg+xml;base64,' + window.btoa(svg_xml);

    const image = new Image();
    image.src = data_uri;
    image.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext('2d');
      context.clearRect(0, 0, image.width, image.height);
      context.drawImage(image, 0, 0);

      const a = document.createElement('a');
      a.download = slice.slice_name;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
  }
}
