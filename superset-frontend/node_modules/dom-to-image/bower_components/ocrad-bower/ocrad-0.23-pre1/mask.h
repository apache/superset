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

class Mask : public Rectangle
  {
  std::vector< Csegment > data;			// csegment in each line

public:
      // Creates a rectangular Mask
  explicit Mask( const Rectangle & re )
    : Rectangle( re ), data( height(), Csegment( re.left(), re.right() ) ) {}
  Mask( const int l, const int t, const int r, const int b )
    : Rectangle( l, t, r, b ), data( height(), Csegment( l, r ) ) {}

  using Rectangle::left;
  using Rectangle::top;
  using Rectangle::right;
  using Rectangle::bottom;
  using Rectangle::height;

  int left ( const int row ) const;
  int right( const int row ) const;

  void top   ( const int t );
  void bottom( const int b );
  void height( const int h ) { bottom( top() + h - 1 ); }

  void add_mask( const Mask & m );
  void add_point( const int row, const int col );
  void add_rectangle( const Rectangle & re );

  bool includes( const Rectangle & re ) const;
  bool includes( const int row, const int col ) const;

  int distance( const Rectangle & re ) const;
  int distance( const int row, const int col ) const;
  };
