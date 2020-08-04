import accessor from './accessor';
import field from './field';

var empty = [];

export var id = field('id');

export var identity = accessor(function(_) { return _; }, empty, 'identity');

export var zero = accessor(function() { return 0; }, empty, 'zero');

export var one = accessor(function() { return 1; }, empty, 'one');

export var truthy = accessor(function() { return true; }, empty, 'true');

export var falsy = accessor(function() { return false; }, empty, 'false');
