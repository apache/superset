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
  declare function levenary (str: string, array: string[]): string;
  declare export default typeof levenary;
}
