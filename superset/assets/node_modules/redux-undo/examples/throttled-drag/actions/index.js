export const DRAG = 'DRAG'

export function drag (x, y) {
  return { type: DRAG, x, y }
}
