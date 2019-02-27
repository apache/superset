interface Margin {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export default function adjustMargin(
  baseMargin: Partial<Margin> = {},
  minMargin: Partial<Margin> = {},
) {
  const { top = 0, left = 0, bottom = 0, right = 0 } = baseMargin;
  const {
    top: minTop = 0,
    left: minLeft = 0,
    bottom: minBottom = 0,
    right: minRight = 0,
  } = minMargin;

  return {
    bottom: Math.max(bottom, minBottom),
    left: Math.max(left, minLeft),
    right: Math.max(right, minRight),
    top: Math.max(top, minTop),
  };
}
