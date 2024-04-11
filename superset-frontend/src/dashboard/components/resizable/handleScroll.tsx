const THRESHOLD = 50;

function getScrollDirection(
  mouseY: number | undefined,
  upperBounds = Infinity,
  lowerBounds = -Infinity,
) {
  if (mouseY === undefined) {
    return 'hold';
  }
  if (mouseY > lowerBounds - THRESHOLD) {
    return 'bottom';
  }
  if (mouseY < upperBounds + THRESHOLD) {
    return 'top';
  }
  return 'hold';
}

export function handleScroll(allowScroll: boolean, mouseY: number | undefined) {
  console.log(mouseY, window.innerHeight);
  const scrollSpeed = 1;
  let scrollTimer: NodeJS.Timeout;
  const handleScrollInterval = () => {
    const bounds = window.innerHeight;
    const direction = getScrollDirection(mouseY, 0, bounds);
    if (direction !== 'hold' && allowScroll) {
      window.scrollBy(0, scrollSpeed * (direction === 'top' ? -1 : 1));
    } else {
      clearInterval(scrollTimer);
    }
  };
  scrollTimer = setInterval(handleScrollInterval, 1);
  return () => clearInterval(scrollTimer as NodeJS.Timeout);
}
