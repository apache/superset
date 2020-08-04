/* description: Parses end executes mathematical expressions. */

/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
[0-9]+("."[0-9]+)?\b  return 'NUMBER'
"n"                   return 'n'
"||"                  return '||'
"&&"                  return '&&'
"?"                   return '?'
":"                   return ':'
"<="                  return '<='
">="                  return '>='
"<"                   return '<'
">"                   return '>'
"!="                  return '!='
"=="                  return '=='
"%"                   return '%'
"("                   return '('
")"                   return ')'
<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

/* operator associations and precedence */

%right <code> '?' ':'
%left '||'
%left '&&'
%left '<=' '>=' '<' '>' '!=' '=='
%left '%'

%start expressions

%% /* language grammar */

expressions
    : e EOF
        { return { type : 'GROUP', expr: $1 }; }
    ;

e
    : e '?' e ':' e
        {$$ = { type: 'TERNARY', expr: $1, truthy : $3, falsey: $5 }; }
    | e '||' e
        {$$ = { type: "OR", left: $1, right: $3 };}
    | e '&&' e
        {$$ = { type: "AND", left: $1, right: $3 };}
    | e '<' e
        {$$ = { type: 'LT', left: $1, right: $3 }; }
    | e '<=' e
        {$$ = { type: 'LTE', left: $1, right: $3 };}
    | e '>' e
        {$$ = { type: 'GT', left: $1, right: $3 };}
    | e '>=' e
        {$$ = { type: 'GTE', left: $1, right: $3 };}
    | e '!=' e
        {$$ = { type: 'NEQ', left: $1, right: $3 };}
    | e '==' e
        {$$ = { type: 'EQ', left: $1, right: $3 };}
    | e '%' e
        {$$ = { type: 'MOD', left: $1, right: $3 };}
    | '(' e ')'
        {$$ = { type: 'GROUP', expr: $2 }; }
    | 'n'
        {$$ = { type: 'VAR' }; }
    | NUMBER
        {$$ = { type: 'NUM', val: Number(yytext) }; }
    ;
