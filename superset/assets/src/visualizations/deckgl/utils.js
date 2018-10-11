export function getRange(data) {
    let minValue = Infinity;
    let maxValue = -Infinity;
    data.forEach((d) => {
          if (d.zipcode !== '') {
                  minValue = Math.min(minValue, d.metric);
                  maxValue = Math.max(maxValue, d.metric);
                }
        });
    return [minValue, maxValue];
}

export function getAlpha(value, breakPoints) {
  const i = breakPoints.map(point => point >= value).indexOf(true);
  return i === -1 ? 1 : i / (breakPoints.length - 1);
}

export function getBreakPoints(fd, features) {
  if (fd.break_points === undefined || fd.break_points.length === 0) {
    const numCategories = fd.num_categories === undefined
      ? 5
      : parseInt(fd.num_categories, 10);
    const [minValue, maxValue] = getRange(features);
    const delta = (maxValue - minValue) / numCategories;
    const precision = Math.max(0, Math.floor(Math.log10(numCategories / delta)));
    return Array(numCategories + 1)
      .fill()
      .map((_, i) => (minValue + i * delta).toFixed(precision));
  }
  return fd.break_points.sort((a, b) => parseFloat(a) - parseFloat(b));
}

export function getCategories(features, fd) {
  const color = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const breakPoints = getBreakPoints(fd, features);
  const categories = {};
  breakPoints.slice(1).forEach((value, i) => {
    const range = breakPoints[i] + ' - ' + breakPoints[i + 1];
    const alpha = (i + 1) / (breakPoints.length - 1);
    categories[range] = {
      color: [color.r, color.g, color.b, alpha],
      enabled: true,
    };
  });
  return categories;
}
