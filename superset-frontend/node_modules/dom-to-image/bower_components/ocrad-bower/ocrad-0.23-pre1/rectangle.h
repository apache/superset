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

class Rectangle
  {
  int left_, top_, right_, bottom_;

public:
  Rectangle( const int l, const int t, const int r, const int b );

  void left  ( const int l );
  void top   ( const int t );
  void right ( const int r );
  void bottom( const int b );
  void height( const int h );
  void width ( const int w );
  void add_point( const int row, const int col );
  void add_rectangle( const Rectangle & re );
  void enlarge( const int scale );
  void move( const int row, const int col );

  int left()    const { return left_;   }
  int top()     const { return top_;    }
  int right()   const { return right_;  }
  int bottom()  const { return bottom_; }
  int height()  const { return bottom_ - top_ + 1; }
  int width()   const { return right_ - left_ + 1; }
  int size()    const { return height() * width(); }
  int hcenter() const { return ( left_ + right_ ) / 2; }
  int vcenter() const { return ( top_ + bottom_ ) / 2; }
  int hpos( const int p ) const
    { return left_ + ( ( ( right_ - left_ ) * p ) / 100 ); }
  int vpos( const int p ) const
    { return top_ + ( ( ( bottom_ - top_ ) * p ) / 100 ); }

  bool operator==( const Rectangle & re ) const
    { return ( left_ == re.left_ && top_ == re.top_ && right_ == re.right_ && bottom_ == re.bottom_ ); }
  bool operator!=( const Rectangle & re ) const { return !( *this == re ); }

  bool includes( const Rectangle & re ) const;
  bool includes( const int row, const int col ) const;
  bool strictly_includes( const Rectangle & re ) const;
  bool strictly_includes( const int row, const int col ) const;
  bool includes_hcenter( const Rectangle & re ) const;
  bool includes_vcenter( const Rectangle & re ) const;
  bool h_includes( const Rectangle & re ) const;
  bool h_includes( const int col ) const;
  bool v_includes( const Rectangle & re ) const;
  bool v_includes( const int row ) const;
  bool h_overlaps( const Rectangle & re ) const;
  bool v_overlaps( const Rectangle & re ) const;
  int  v_overlap_percent( const Rectangle & re ) const;
  bool is_hcentred_in( const Rectangle & re ) const;
  bool is_vcentred_in( const Rectangle & re ) const;
  bool precedes( const Rectangle & re ) const;
  bool h_precedes( const Rectangle & re ) const;
  bool v_precedes( const Rectangle & re ) const;

  int distance( const Rectangle & re ) const;
  int distance( const int row, const int col ) const;
  int h_distance( const Rectangle & re ) const;
  int h_distance( const int col ) const;
  int v_distance( const Rectangle & re ) const;
  int v_distance( const int row ) const;

  static int hypoti( const int c1, const int c2 );
  };
