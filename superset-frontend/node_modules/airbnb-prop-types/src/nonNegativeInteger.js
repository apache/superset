import and from './and';
import integer from './integer';
import nonNegativeNumber from './nonNegativeNumber';

export default and([integer(), nonNegativeNumber()], 'nonNegativeInteger');
