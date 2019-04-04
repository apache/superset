const PERCENT_OR_PIXELS_REGEX = /([0-9]+\.?[0-9]*)(%|px)/;

// Takes a number or a string of formats `50%`, `33.3%` or `200px`
export function parsePosition(value) {
  switch (typeof value) {
    case 'number':
      return {
        position: value,
        relative: false
      };

    case 'string':
      const match = value.match(PERCENT_OR_PIXELS_REGEX);
      if (match && match.length >= 3) {
        const relative = match[2] === '%';
        const position = parseFloat(match[1]);
        return {
          position: relative ? position / 100 : position,
          relative
        };
      }
    // fallthrough

    default:
      // eslint-disable-line
      throw new Error(`Could not parse position string ${value}`);
  }
}

export function getPosition(position, extent) {
  return position.relative ? Math.round(position.position * extent) : position.position;
}
