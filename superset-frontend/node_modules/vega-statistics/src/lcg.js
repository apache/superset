export default function(seed) {
  // Random numbers using a Linear Congruential Generator with seed value
  // Uses glibc values from https://en.wikipedia.org/wiki/Linear_congruential_generator
  return function() {
    seed = (1103515245 * seed + 12345) % 2147483647;
    return seed / 2147483647;
  };
}
