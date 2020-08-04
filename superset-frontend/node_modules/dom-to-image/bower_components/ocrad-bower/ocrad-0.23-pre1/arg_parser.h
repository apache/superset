/*  Arg_parser - POSIX/GNU command line argument parser. (C++ version)
    Copyright (C) 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013
    Antonio Diaz Diaz.

    This library is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this library.  If not, see <http://www.gnu.org/licenses/>.

    As a special exception, you may use this file as part of a free
    software library without restriction.  Specifically, if other files
    instantiate templates or use macros or inline functions from this
    file, or you compile this file and link it with other files to
    produce an executable, this file does not by itself cause the
    resulting executable to be covered by the GNU General Public
    License.  This exception does not however invalidate any other
    reasons why the executable file might be covered by the GNU General
    Public License.
*/

/*  Arg_parser reads the arguments in 'argv' and creates a number of
    option codes, option arguments and non-option arguments.

    In case of error, 'error' returns a non-empty error message.

    'options' is an array of 'struct Option' terminated by an element
    containing a code which is zero. A null name means a short-only
    option. A code value outside the unsigned char range means a
    long-only option.

    Arg_parser normally makes it appear as if all the option arguments
    were specified before all the non-option arguments for the purposes
    of parsing, even if the user of your program intermixed option and
    non-option arguments. If you want the arguments in the exact order
    the user typed them, call 'Arg_parser' with 'in_order' = true.

    The argument '--' terminates all options; any following arguments are
    treated as non-option arguments, even if they begin with a hyphen.

    The syntax for optional option arguments is '-<short_option><argument>'
    (without whitespace), or '--<long_option>=<argument>'.
*/

class Arg_parser
  {
public:
  enum Has_arg { no, yes, maybe };

  struct Option
    {
    int code;			// Short option letter or code ( code != 0 )
    const char * name;		// Long option name (maybe null)
    Has_arg has_arg;
    };

private:
  struct Record
    {
    int code;
    std::string argument;
    explicit Record( const int c = 0 ) : code( c ) {}
    };

  std::string error_;
  std::vector< Record > data;

  bool parse_long_option( const char * const opt, const char * const arg,
                          const Option options[], int & argind );
  bool parse_short_option( const char * const opt, const char * const arg,
                           const Option options[], int & argind );

public:
  Arg_parser( const int argc, const char * const argv[],
              const Option options[], const bool in_order = false );

      // Restricted constructor. Parses a single token and argument (if any)
  Arg_parser( const char * const opt, const char * const arg,
              const Option options[] );

  const std::string & error() const { return error_; }

      // The number of arguments parsed (may be different from argc)
  int arguments() const { return data.size(); }

      // If code( i ) is 0, argument( i ) is a non-option.
      // Else argument( i ) is the option's argument (or empty).
  int code( const int i ) const
    {
    if( i >= 0 && i < arguments() ) return data[i].code;
    else return 0;
    }

  const std::string & argument( const int i ) const
    {
    if( i >= 0 && i < arguments() ) return data[i].argument;
    else return error_;
    }
  };
