# Command Line Interface (CLI)

When math.js is installed globally using npm, its expression parser can be used
from the command line. To install math.js globally:

```bash
$ npm install -g mathjs
```

Normally, a global installation must be run with admin rights (precede the
command with `sudo`). After installation, the application `mathjs` is available
via the command line:

```bash
$ mathjs
> 12 / (2.3 + 0.7)
4
> 12.7 cm to inch
5 inch
> sin(45 deg) ^ 2
0.5
> 9 / 3 + 2i
3 + 2i
> det([-1, 2; 3, 1])
-7
```

The command line interface can be used to open a prompt, to execute a script,
or to pipe input and output streams:

```bash
$ mathjs                                 # Open a command prompt
$ mathjs script.txt                      # Run a script file, output to console
$ mathjs script1.txt script2.txt         # Run two script files
$ mathjs script.txt > results.txt        # Run a script file, output to file
$ cat script.txt | mathjs                # Run input stream, output to console
$ cat script.txt | mathjs > results.txt  # Run input stream, output to file
```

You can also use it to create LaTeX from or sanitize your expressions using the
`--tex` and `--string` options:

```bash
$ mathjs --tex
> 1/2
\frac{1}{2}
```

```bash
$ mathjs --string
> (1+1+1)
(1 + 1 + 1)
```

To change the parenthesis option use the `--parenthesis=` flag:

```bash
$ mathjs --string --parenthesis=auto
> (1+1+1)
1 + 1 + 1
```

```bash
$ mathjs --string --parenthesis=all
> (1+1+1)
(1 + 1) + 1
```

# Command line debugging (REPL)

For debugging purposes, `bin/repl.js` provides a REPL (Read Evaluate Print Loop)
for interactive testing of mathjs without having to build new build files after every
little change to the source files. You can either start it directly (`./bin/repl.js`) or
via node (`node bin/repl.js`).

You can exit using either [ctrl]-[C] or [ctrl]-[D].

```bash
$ ./bin/repl.js 
> math.parse('1+1')
{ op: '+',
  fn: 'add',
  args: 
   [ { value: '1', valueType: 'number' },
     { value: '1', valueType: 'number' } ] }
> 
```
