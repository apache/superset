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

class Blob : public Bitmap
  {
  std::vector< Bitmap * > holepv;		// vector of holes

public:
  Blob( const int l, const int t, const int r, const int b )
    : Bitmap( l, t, r, b ) {}

  Blob( const Bitmap & source, const Rectangle & re )
    : Bitmap( source, re ) {}

  Blob( const Blob & b );
  Blob & operator=( const Blob & b );

  ~Blob();

  using Bitmap::left;
  using Bitmap::top;
  using Bitmap::right;
  using Bitmap::bottom;
  using Bitmap::height;
  using Bitmap::width;
  void left  ( const int l );
  void top   ( const int t );
  void right ( const int r );
  void bottom( const int b );
  void height( const int h ) { bottom( top() + h - 1 ); }
  void width ( const int w ) { right( left() + w - 1 ); }

  const Bitmap & hole( const int i ) const;
  int holes() const { return holepv.size(); }
  //  id = 1 for blob dots, negative for hole dots, 0 otherwise
  int id( const int row, const int col ) const;

  bool is_abnormal() const
    { return height() < 10 || height() >= 5 * width() || width() >= 3 * height(); }
  bool test_BD() const;
  bool test_Q() const;
  void print( FILE * const outfile ) const;

  void fill_hole( const int i );
  void find_holes();
  };
