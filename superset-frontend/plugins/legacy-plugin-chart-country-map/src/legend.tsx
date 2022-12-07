import d3 from 'd3';

export type LegendProps = {
  top: number;
  left: number;
  title?: string;
  data: any;
  width: number;
  height: number;
  svg: any;
  domain: number[];
  fontSize: number;
  padding: number;
  display:
    | 'None'
    | 'Top'
    | 'TopLeft'
    | 'TopRight'
    | 'Bottom'
    | 'BottomLeft'
    | 'BottomRight';
  orientation: 'Horizontal' | 'Vertical';
  format: (value: number) => any;
  colorScale: any;
  colorSchema: any;
};

function legend({
  top = 0,
  left = 0,
  title,
  data,
  width = 250,
  height = 30,
  svg,
  fontSize = 7,
  padding = 2,
  display = 'None',
  orientation = 'Horizontal',
  format = v => Math.ceil(v),
  colorScale,
  colorSchema,
}: LegendProps): void {
  if (display === 'None') {
    svg.selectAll('.legend').remove();

    return;
  }
  const isHorizontal = orientation === 'Horizontal';
  const divider = isHorizontal ? 2 : 4;
  const multiplier = isHorizontal ? 1 : 3;
  const baseH = isHorizontal ? Math.max(60, height * 0.1) : height / 2;
  const baseW =
    ['Top', 'Bottom'].indexOf(display) !== -1 ? width : width / divider;
  let baseLeft = left;
  let baseTop = top;

  switch (display) {
    case 'TopRight':
      baseLeft = left + (width / divider) * multiplier;
      break;
    case 'Bottom':
      baseTop = height - baseH;
      break;
    case 'BottomLeft':
      baseTop = height - baseH;
      break;
    case 'BottomRight':
      baseTop = height - baseH;
      baseLeft = left + (width / divider) * multiplier;
      break;
    default:
      break;
  }

  const min = Math.min(...data.map((d: { metric: number }) => d.metric));
  const max = Math.max(...data.map((d: { metric: number }) => d.metric));
  const colors = colorSchema.colors || [];
  const domainValues = d3.range(min, max, (max - min) / colors.length);

  const titleH = title ? fontSize + padding * 4 : 0;

  const rectW = baseW / (isHorizontal ? colors.length : 1);
  const rectH = Math.min(
    fontSize + padding * 4,
    (baseH - titleH - (isHorizontal ? titleH : 0)) /
      (isHorizontal ? 1 : colors.length),
  );
  if (display.indexOf('Bottom') !== -1) {
    baseTop += isHorizontal ? 0 : baseH - titleH - rectH * colors.length;
  }

  if (title) {
    svg
      .selectAll('text.legend.legend-title')
      .data([title])
      .enter()
      .append('text')
      .attr('class', 'legend legend-title')
      .attr('x', baseLeft + baseW / 2)
      .attr('y', baseTop + fontSize + padding * 2)
      .attr('font-size', fontSize)
      .attr('text-anchor', 'middle')
      .attr('font-weight', 'bold')
      .text(title);
  }

  svg
    .selectAll('rect.legend.legend-rect')
    .data(domainValues)
    .enter()
    .append('rect')
    .attr('class', 'legend legend-rect')
    .attr('x', (_: any, i: number) =>
      isHorizontal ? baseLeft + i * rectW : baseLeft,
    )
    .attr('y', (_: any, i: number) =>
      isHorizontal ? baseTop + titleH : baseTop + titleH + rectH * i,
    )
    .attr('range', (d: any) => `${d}`)
    .attr('width', rectW)
    .attr('height', rectH)
    .attr('fill', (v: number) => colorScale(v))
    .attr('stroke', 'white')
    .attr('stroke-width', padding);

  svg
    .selectAll('text.legend.legend-label')
    .data(domainValues)
    .enter()
    .append('text')
    .attr('class', 'legend legend-label')
    .attr('x', (d: any, i: number) =>
      isHorizontal ? baseLeft + (i * rectW + rectW / 2) : baseLeft + baseW / 2,
    )
    .attr('y', (d: any, i: number) =>
      isHorizontal
        ? rectH + baseTop + titleH + padding * 4
        : baseTop + titleH + rectH * i + padding * 5,
    )
    .attr('width', rectW)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .text((d: any, i: number) => {
      if (i === 0) {
        return `${format(d)} - ${format(domainValues[i + 1])}`;
      }
      if (i === domainValues.length - 1) {
        return `${format(domainValues[i - 1])} - ${format(d)}`;
      }
      return `${format(domainValues[i - 1])} - ${format(domainValues[i + 1])}`;
    })
    .attr('font-size', fontSize)
    .attr('font-weight', 'normal')
    // Dotted text when label is too long
    .each(function () {
      // Disable typescript for this function
      // @ts-ignore
      const text = d3.select(this);
      // @ts-ignore
      const textWidth = text.node().getComputedTextLength();
      const textLength = text.text().length;
      const textDots = '...';

      if (textWidth > rectW) {
        const dotsWidth = text
          .append('text')
          .text(textDots)
          .attr('font-size', fontSize)
          .attr('font-weight', 'normal')
          .node()
          // @ts-ignore
          .getComputedTextLength();

        const maxTextLength = Math.floor(
          (rectW - dotsWidth) / (textWidth / textLength),
        );
        const textContent = text.text().slice(0, maxTextLength) + textDots;
        text.text(textContent);
      }
    })
    .attr('fill', (d: any) => {
      if (isHorizontal) {
        return 'black';
      }
      const color = d3.rgb(colorScale(d));
      const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
      return luminance > 128 ? 'black' : 'white';
    });
}

export default legend;
