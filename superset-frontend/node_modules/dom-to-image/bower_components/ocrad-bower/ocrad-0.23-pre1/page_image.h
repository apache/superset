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

struct OCRAD_Pixmap;
class Mask;
class Rational;
class Track;

class Page_image : public Rectangle		// left,top is always 0,0
  {
public:
  struct Error
    {
    const char * const msg;
    explicit Error( const char * const s ) : msg( s ) {}
    };

  using Rectangle::left;
  using Rectangle::top;
  using Rectangle::right;
  using Rectangle::bottom;
  using Rectangle::height;
  using Rectangle::width;

private:
  std::vector< std::vector< uint8_t > > data;	// 256 level greymap
  uint8_t maxval_, threshold_;			// x > threshold == white

  void read_p1( FILE * const f, const bool invert );
  void read_p4( FILE * const f, const bool invert );
  void read_p2( FILE * const f, const bool invert );
  void read_p5( FILE * const f, const bool invert );
  void read_p3( FILE * const f, const bool invert );
  void read_p6( FILE * const f, const bool invert );

  void left  ( int );		// resize functions declared as private
  void top   ( int );
  void right ( int );
  void bottom( int );
  void height( int );
  void width ( int );

public:
  // Creates a Page_image from a pbm, pgm or ppm file
  Page_image( FILE * const f, const bool invert );

  // Creates a Page_image from a OCRAD_Pixmap
  Page_image( const OCRAD_Pixmap & image, const bool invert );

  // Creates a reduced Page_image
  Page_image( const Page_image & source, const int scale );

  bool get_bit( const int row, const int col ) const
    { return data[row-top()][col-left()] <= threshold_; }
  bool get_bit( const int row, const int col, const uint8_t th ) const
    { return data[row-top()][col-left()] <= th; }
  void set_bit( const int row, const int col, const bool bit )
    { data[row-top()][col-left()] = ( bit ? 0 : maxval_ ); }

  uint8_t maxval() const { return maxval_; }
  uint8_t threshold() const { return threshold_; }
  void threshold( const Rational & th );	// 0 <= th <= 1, else auto
  void threshold( const int th );		// 0 <= th <= 255, else auto

  bool cut( const Rational ltwh[4] );
  void draw_mask( const Mask & m );
  void draw_rectangle( const Rectangle & re );
  void draw_track( const Track & tr );
  bool save( FILE * const f, const char filetype ) const;
  bool scale( int n );
  void transform( const Transformation & t );
  };
