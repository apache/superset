import { ChannelInput } from '../../types/Channel';

/**
 * Discrete domains are converted into string[]
 * when using D3 scales
 * @param domain
 */
export default function parseDiscreteDomain<T extends ChannelInput>(domain: T[]) {
  return domain.map(d => `${d}`);
}
