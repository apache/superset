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

class Vrhomboid			// Rhomboid with two vertical sides.
  {
  int left_, lvcenter_, right_, rvcenter_, height_;

public:
  Vrhomboid( const int l, const int lc, const int r, const int rc, const int h );

  int left()     const { return left_;     }
  int lvcenter() const { return lvcenter_; }
  int right()    const { return right_;    }
  int rvcenter() const { return rvcenter_; }
  int height()   const { return height_;   }
  int width()    const { return right_ - left_ + 1; }
  int size()     const { return height_ * width(); }

  void left( const int l );
  void lvcenter( const int lc ) { lvcenter_ = lc; }
  void right( const int r );
  void rvcenter( const int rc ) { rvcenter_ = rc; }
  void height( const int h );
  void extend_left( const int l );
  void extend_right( const int r );

  int bottom( const int col ) const { return vcenter( col ) + ( height_ / 2 ); }
  int top( const int col ) const { return bottom( col ) - height_ + 1; }
  int vcenter( const int col ) const;

  bool includes( const Rectangle & r ) const;
  bool includes( const int row, const int col ) const;
  };


class Track		// vector of Vrhomboids tracking a Textline.
  {
  std::vector< Vrhomboid > data;

public:
  Track() {}
  Track( const Track & t ) : data( t.data ) {}
  Track & operator=( const Track & t )
    { if( this != &t ) { data = t.data; } return *this; }

  void set_track( const std::vector< Rectangle > & rectangle_vector );

  int segments() const { return data.size(); }
  int height() const { return data.size() ? data[0].height() : 0; }
  int left() const { return data.size() ? data[0].left() : 0; }
  int right() const { return data.size() ? data.back().right() : 0; }

  int bottom( const int col ) const;
  int top( const int col ) const;
  int vcenter( const int col ) const;

  bool includes( const Rectangle & r ) const;
  bool includes( const int row, const int col ) const;
  };
