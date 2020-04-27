// export default function createTickLabelProps({
//   labelAngle,
//   labelOverlap,
//   orient,
//   tickTextAnchor = 'start',
// }: {
//   labelAngle: number;
//   labelOverlap: string;
//   orient: string;
//   tickTextAnchor?: string;
// }) {
//   let dx = 0;
//   let dy = 0;
//   if (labelOverlap === 'rotate' && labelAngle !== 0) {
//     dx = labelAngle > 0 ? -6 : 6;
//     if (orient === 'top') {
//       dx = 0;
//     }
//     dy = orient === 'top' ? -3 : 0;
//   }

//   return {
//     angle: labelAngle,
//     dx,
//     dy,
//     textAnchor: tickTextAnchor,
//   };
// }
