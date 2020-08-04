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

class Profile
  {
public:
  enum Type { left, top, right, bottom, height, width };

private:
  const Bitmap & bm;		// Bitmap to witch this profile belongs
				// can be a Blob or a hole
  Type type;
  int limit_, max_, min_, mean_;
  signed char isconcave_, isconvex_, isflat_, isflats_,
              ispit_, istpit_, isupit_, isvpit_, istip_;
  std::vector< int > data;

  void initialize();
  int mean();

public:
  Profile( const Bitmap & bm_, const Type t );

//  const Bitmap & bitmap() const { return bm; }

  int limit() { if( limit_ < 0 ) initialize(); return limit_; }
  int max();
  int max( const int l, int r = -1 );
  int min();
  int min( const int l, int r = -1 );
  int operator[]( int i );
  int pos( const int p ) { return ( ( samples() - 1 ) * p ) / 100; }
  int range() { return max() - min(); }
  int samples() { if( limit_ < 0 ) initialize(); return data.size(); }

  int  area( const int l = 0, int r = -1 );
  bool increasing( int i = 1, const int min_delta = 2 );
  bool decreasing( int i = 1 );
  bool isconcave();
  bool isconvex();
  bool isflat();
  bool isflats();
  bool ispit();
  bool iscpit( const int cpos = 50 );
  bool islpit();
  bool istpit();
  bool isupit();
  bool isvpit();
  bool istip();
  bool isctip( const int cpos = 50 );
  int  imaximum();
  int  iminimum( const int m = 0, int th = -1 );
  int  minima( int th = -1 );
  bool straight( int * const dyp );
  };
