declare const arrayMove: {
	/**
	Move an array item to a different position.

	@param array - The array to move the item in.
	@param from - Index of item to move. If negative, it will begin that many elements from the end.
	@param to - Index of where to move the item. If negative, it will begin that many elements from the end.
	@returns A new array with the item moved to the new position.

	@example
	```
	import arrayMove = require('array-move');

	const input = ['a', 'b', 'c'];

	arrayMove(input, 1, 2);
	//=> ['a', 'c', 'b']

	arrayMove(input, -1, 0);
	//=> ['c', 'a', 'b']

	arrayMove(input, -2, -3);
	//=> ['b', 'a', 'c']
	```
	*/
	<ValueType>(array: ReadonlyArray<ValueType>, from: number, to: number): ValueType[];

	/**
	Moves the item to the new position in the input array. Useful for huge arrays where absolute performance is needed.

	@param array - The array to modify.
	@param from - Index of item to move. If negative, it will begin that many elements from the end.
	@param to - Index of where to move the item. If negative, it will begin that many elements from the end.
	*/
	mutate(array: unknown[], from: number, to: number): void;

	// TODO: Remove this for the next major release
	default: typeof arrayMove;
};

export = arrayMove;
