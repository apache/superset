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

struct Csegment			// cartesian (one-dimensional) segment
  {
  int left, right;		// l > r means no segment
				// in vertical segments, left is top

  explicit Csegment( const int l = 1, const int r = 0 )
    : left( l ), right( r ) {}

  void add_point( const int col );
  void add_csegment( const Csegment & seg );

  bool valid() const { return ( left <= right ); }
  int size() const { return ( left <= right ) ? right - left + 1 : 0; }
  bool includes( const Csegment & seg ) const
    { return ( seg.valid() && left <= seg.left && seg.right <= right ); }
  bool includes( const int col ) const
    { return ( left <= col && col <= right ); }

  int distance( const Csegment & seg ) const;
  int distance( const int col ) const;
  };
