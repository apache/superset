declare module "levenary" {
  /**
  Return the string within `array`, whose Levenshtein distance from `str` is minimal.

	@example
	```
	import levenary from 'levenary';

	levenary('cat', ['cow', 'dog', 'pig']);
	//=> 'cow'
	```
	*/
  const levenary: (str: string, array: string[]) => string;
  export default levenary;
}
