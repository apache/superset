"This is a polyglot Python/JavaScript file.";

add('comment', Diagram(
	'/*',
	ZeroOrMore(
		NonTerminal('anything but * followed by /')),
	'*/'));

add('newline', Diagram(Choice(0, '\\n', '\\r\\n', '\\r', '\\f')));

add('whitespace', Diagram(Choice(
	0, 'space', '\\t', NonTerminal('newline'))));

add('hex digit', Diagram(NonTerminal('0-9 a-f or A-F')));

add('escape', Diagram(
	'\\', Choice(0,
		NonTerminal('not newline or hex digit'),
		Sequence(
			OneOrMore(NonTerminal('hex digit'), Comment('1-6 times')),
			Optional(NonTerminal('whitespace'), 'skip')))));

add('<whitespace-token>', Diagram(OneOrMore(NonTerminal('whitespace'))));

add('ws*', Diagram(ZeroOrMore(NonTerminal('<whitespace-token>'))));

add('<ident-token>', Diagram(
	Choice(0, Skip(), '-'),
	Choice(0, NonTerminal('a-z A-Z _ or non-ASCII'), NonTerminal('escape')),
	ZeroOrMore(Choice(0,
		NonTerminal('a-z A-Z 0-9 _ - or non-ASCII'), NonTerminal('escape')))));

add('<function-token>', Diagram(
	NonTerminal('<ident-token>'), '('));

add('<at-keyword-token>', Diagram(
	'@', NonTerminal('<ident-token>')));

add('<hash-token>', Diagram(
	'#', OneOrMore(Choice(0,
		NonTerminal('a-z A-Z 0-9 _ - or non-ASCII'),
		NonTerminal('escape')))));

add('<string-token>', Diagram(
	Choice(0,
		Sequence(
			'"',
			ZeroOrMore(
				Choice(0,
					NonTerminal('not " \\ or newline'),
					NonTerminal('escape'),
					Sequence('\\', NonTerminal('newline')))),
			'"'),
		Sequence(
			'\'',
			ZeroOrMore(
				Choice(0,
					NonTerminal("not ' \\ or newline"),
					NonTerminal('escape'),
					Sequence('\\', NonTerminal('newline')))),
			'\''))));

add('<url-token>', Diagram(
	NonTerminal('<ident-token "url">'),
	'(',
	NonTerminal('ws*'),
	Optional(Sequence(
		Choice(0, NonTerminal('url-unquoted'), NonTerminal('STRING')),
		NonTerminal('ws*'))),
	')'));

add('url-unquoted', Diagram(OneOrMore(
	Choice(0,
		NonTerminal('not " \' ( ) \\ whitespace or non-printable'),
		NonTerminal('escape')))));

add('<number-token>', Diagram(
	Choice(1, '+', Skip(), '-'),
	Choice(0,
		Sequence(
			OneOrMore(NonTerminal('digit')),
			'.',
			OneOrMore(NonTerminal('digit'))),
		OneOrMore(NonTerminal('digit')),
		Sequence(
			'.',
			OneOrMore(NonTerminal('digit')))),
	Choice(0,
		Skip(),
		Sequence(
			Choice(0, 'e', 'E'),
			Choice(1, '+', Skip(), '-'),
			OneOrMore(NonTerminal('digit'))))));

add('<dimension-token>', Diagram(
	NonTerminal('<number-token>'), NonTerminal('<ident-token>')));

add('<percentage-token>', Diagram(
	NonTerminal('<number-token>'), '%'));

add('<unicode-range-token>', Diagram(
	Choice(0,
		'U',
		'u'),
	'+',
	Choice(0,
		Sequence(OneOrMore(NonTerminal('hex digit'), Comment('1-6 times'))),
		Sequence(
			ZeroOrMore(NonTerminal('hex digit'), Comment('1-5 times')),
			OneOrMore('?', Comment('1 to (6 - digits) times'))),
		Sequence(
			OneOrMore(NonTerminal('hex digit'), Comment('1-6 times')),
			'-',
			OneOrMore(NonTerminal('hex digit'), Comment('1-6 times'))))));

add('<include-match-token>', Diagram('~='));

add('<dash-match-token>', Diagram('|='));

add('<prefix-match-token>', Diagram('^='));

add('<suffix-match-token>', Diagram('$='));

add('<substring-match-token>', Diagram('*='));

add('<column-token>', Diagram('||'));

add('<CDO-token>', Diagram('<' + '!--'));

add('<CDC-token>', Diagram('-' + '->'));


NonTerminal = NonTerminal;

add('Stylesheet', Diagram(ZeroOrMore(Choice(3,
	NonTerminal('<CDO-token>'), NonTerminal('<CDC-token>'), NonTerminal('<whitespace-token>'),
	NonTerminal('Qualified rule'), NonTerminal('At-rule')))));

add('Rule list', Diagram(ZeroOrMore(Choice(1,
	NonTerminal('<whitespace-token>'), NonTerminal('Qualified rule'), NonTerminal('At-rule')))));

add('At-rule', Diagram(
	NonTerminal('<at-keyword-token>'), ZeroOrMore(NonTerminal('Component value')),
	Choice(0, NonTerminal('{} block'), ';')));

add('Qualified rule', Diagram(
	ZeroOrMore(NonTerminal('Component value')),
	NonTerminal('{} block')));

add('Declaration list', Diagram(
	NonTerminal('ws*'),
	Choice(0,
		Sequence(
			Optional(NonTerminal('Declaration')),
			Optional(Sequence(';', NonTerminal('Declaration list')))),
		Sequence(
			NonTerminal('At-rule'),
			NonTerminal('Declaration list')))));

add('Declaration', Diagram(
	NonTerminal('<ident-token>'), NonTerminal('ws*'), ':',
	ZeroOrMore(NonTerminal('Component value')), Optional(NonTerminal('!important'))));

add('!important', Diagram(
	'!', NonTerminal('ws*'), NonTerminal('<ident-token "important">'), NonTerminal('ws*')));

add('Component value', Diagram(Choice(0,
	NonTerminal('Preserved token'),
	NonTerminal('{} block'),
	NonTerminal('() block'),
	NonTerminal('[] block'),
	NonTerminal('Function block'))));


add('{} block', Diagram('{', ZeroOrMore(NonTerminal('Component value')), '}'));
add('() block', Diagram('(', ZeroOrMore(NonTerminal('Component value')), ')'));
add('[] block', Diagram('[', ZeroOrMore(NonTerminal('Component value')), ']'));

add('Function block', Diagram(
	NonTerminal('<function-token>'),
	ZeroOrMore(NonTerminal('Component value')),
	')'));

