/*  GNU Ocrad - Optical Character Recognition program
    Copyright (C) 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011,
    2012, 2013 Antonio Diaz Diaz.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

extern int verbosity;


namespace Ocrad {

void internal_error( const char * const msg );
bool similar( const int a, const int b,
              const int percent_dif, const int abs_dif = 1 );

} // end namespace Ocrad


class Charset
  {
  int charset_;

public:
  enum Value { ascii = 1, iso_8859_9 = 2, iso_8859_15 = 4 };

  Charset() : charset_( 0 ) {}
  bool enable( const char * const name );
  bool enabled( const Value cset ) const;
  bool only( const Value cset ) const;
  void show_error( const char * const program_name,
                   const char * const arg ) const;
  };


class Filter
  {
public:
  enum Type { none, letters, letters_only, numbers, numbers_only };
private:
  Type type_;

public:
  Filter() : type_( none ) {}
  bool set( const char * const name );
  Type type() const { return type_; }
  void show_error( const char * const program_name,
                   const char * const arg ) const;
  };


class Transformation
  {
public:
  enum Type { none, rotate90, rotate180, rotate270,
              mirror_lr, mirror_tb, mirror_d1, mirror_d2 };
private:
  Type type_;

public:
  Transformation() : type_( none ) {}
  bool set( const char * const name );
  Type type() const { return type_; }
  void show_error( const char * const program_name,
                   const char * const arg ) const;
  };


struct Control
  {
  Charset charset;
  Filter filter;
  FILE * outfile, * exportfile;
  int debug_level;
  char filetype;
  bool utf8;

  Control()
    : outfile( stdout ), exportfile( 0 ),
      debug_level( 0 ), filetype( '4' ), utf8( false ) {}

  bool set_format( const char * const name );
  };
