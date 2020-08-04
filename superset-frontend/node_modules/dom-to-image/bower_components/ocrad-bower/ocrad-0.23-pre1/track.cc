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

#include <algorithm>
#include <cstdio>
#include <vector>
#include <cstdlib>

#include "common.h"
#include "rectangle.h"
#include "track.h"


namespace {

void error( const char * const msg )
  { Ocrad::internal_error( msg ); }


int good_reference( const Rectangle & r1, const Rectangle & r2, int & val,
                    const int mean_height, const int mean_width )
  {
  if( 4 * r1.height() >= 3 * mean_height &&
      4 * r2.height() >= 3 * mean_height &&
      ( r1.width() >= mean_width || r2.width() >= mean_width ) && val > 0 )
    {
    if( 4 * r1.height() <= 5 * mean_height &&
        4 * r2.height() <= 5 * mean_height )
      {
      if( 9 * r1.height() <= 10 * mean_height &&
          9 * r2.height() <= 10 * mean_height &&
          10 * std::abs( r1.bottom() - r2.bottom() ) <= mean_height )
        { val = 0; return ( r1.height() <= r2.height() ) ? 0 : 1; }
      if( val > 1 && 10 * std::abs( r1.vcenter() - r2.vcenter() ) <= mean_height )
        { val = 1; return ( r1.bottom() <= r2.bottom() ) ? 0 : 1; }
      }
    if( val > 2 && 10 * std::abs( r1.vcenter() - r2.vcenter() ) <= mean_height )
      { val = 2; return ( r1.bottom() <= r2.bottom() ) ? 0 : 1; }
    }
  return -1;
  }


int set_l( const std::vector< Rectangle > & rectangle_vector,
           const int mean_height, const int mean_width )
  {
  const int rectangles = rectangle_vector.size();
  const int imax = rectangles / 4;
  int ibest = -1, val = 3;
  for( int i1 = 0; i1 < imax && val > 0; ++i1 )
    for( int i2 = i1 + 1; i2 <= imax && i2 <= i1 + 2; ++i2 )
      {
      int i = good_reference( rectangle_vector[i1], rectangle_vector[i2],
                              val, mean_height, mean_width );
      if( i >= 0 ) { ibest = (i == 0) ? i1 : i2; if( val == 0 ) break; }
      }
  return ibest;
  }


int set_r( const std::vector< Rectangle > & rectangle_vector,
           const int mean_height, const int mean_width )
  {
  const int rectangles = rectangle_vector.size();
  const int imin = rectangles - 1 - ( rectangles / 4 );
  int ibest = -1, val = 3;
  for( int i1 = rectangles - 1; i1 > imin && val > 0; --i1 )
    for( int i2 = i1 - 1; i2 >= imin && i2 >= i1 - 2; --i2 )
      {
      int i = good_reference( rectangle_vector[i1], rectangle_vector[i2],
                              val, mean_height, mean_width );
      if( i >= 0 ) { ibest = (i == 0) ? i1 : i2; if( val == 0 ) break; }
      }
  return ibest;
  }


Vrhomboid set_partial_track( const std::vector< Rectangle > & rectangle_vector )
  {
  const int rectangles = rectangle_vector.size();
  int mean_vcenter = 0, mean_height = 0, mean_width = 0;

  for( int i = 0; i < rectangles; ++i )
    {
    mean_vcenter += rectangle_vector[i].vcenter();
    mean_height += rectangle_vector[i].height();
    mean_width += rectangle_vector[i].width();
    }
  if( rectangles )
    { mean_vcenter /= rectangles; mean_height /= rectangles; mean_width /= rectangles; }

  // short line
  if( rectangles < 8 )
    return Vrhomboid( rectangle_vector.front().left(), mean_vcenter,
                      rectangle_vector.back().right(), mean_vcenter,
                      mean_height );

  // look for reference rectangles (characters)
  int l = set_l( rectangle_vector, mean_height, mean_width );
  int r = set_r( rectangle_vector, mean_height, mean_width );

  int lcol, lvc, rcol, rvc;
  if( l >= 0 )
    {
    lcol = rectangle_vector[l].hcenter();
    lvc = rectangle_vector[l].bottom() - ( mean_height / 2 );
    }
  else { lcol = rectangle_vector.front().hcenter(); lvc = mean_vcenter; }
  if( r >= 0 )
    {
    rcol = rectangle_vector[r].hcenter();
    rvc = rectangle_vector[r].bottom() - ( mean_height / 2 );
    }
  else { rcol = rectangle_vector.back().hcenter(); rvc = mean_vcenter; }
  Vrhomboid tmp( lcol, lvc, rcol, rvc, mean_height );
  tmp.extend_left( rectangle_vector.front().left() );
  tmp.extend_right( rectangle_vector.back().right() );
  return tmp;
  }

} // end namespace


Vrhomboid::Vrhomboid( const int l, const int lc, const int r, const int rc,
                      const int h )
  {
  if( r < l || h <= 0 )
    {
    if( verbosity >= 0 )
      std::fprintf( stderr, "l = %d, lc = %d, r = %d, rc = %d, h = %d\n",
                    l, lc, r, rc, h );
    error( "bad parameter building a Vrhomboid" );
    }
  left_ = l; lvcenter_ = lc; right_ = r; rvcenter_ = rc; height_ = h;
  }


void Vrhomboid::left( const int l )
  {
  if( l > right_ ) error( "left, bad parameter resizing a Vrhomboid" );
  left_ = l;
  }


void Vrhomboid::right( const int r )
  {
  if( r < left_ ) error( "right, bad parameter resizing a Vrhomboid" );
  right_ = r;
  }


void Vrhomboid::height( const int h )
  {
  if( h <= 0 ) error( "height, bad parameter resizing a Vrhomboid" );
  height_ = h;
  }


void Vrhomboid::extend_left( const int l )
  {
  if( l > right_ )
    error( "extend_left, bad parameter resizing a Vrhomboid" );
  lvcenter_ = vcenter( l ); left_ = l;
  }


void Vrhomboid::extend_right( const int r )
  {
  if( r < left_ )
    error( "extend_right, bad parameter resizing a Vrhomboid" );
  rvcenter_ = vcenter( r ); right_ = r;
  }


int Vrhomboid::vcenter( const int col ) const
  {
  const int dx = right_ - left_, dy = rvcenter_ - lvcenter_;
  int vc = lvcenter_;
  if( dx && dy ) vc += ( dy * ( col - left_ ) ) / dx;
  return vc;
  }


bool Vrhomboid::includes( const Rectangle & r ) const
  {
  if( r.left() < left_ || r.right() > right_ ) return false;
  const int tl = top( r.left() ), bl = bottom( r.left() );
  const int tr = top( r.right() ), br = bottom( r.left() );
  const int t = std::max( tl, tr ), b = std::min( bl, br );
  return ( t <= r.top() && b >= r.bottom() );
  }


bool Vrhomboid::includes( const int row, const int col ) const
  {
  if( col < left_ || col > right_ ) return false;
  const int t = top( col ), b = bottom( col );
  return ( t <= row && b >= row );
  }


// rectangle_vector must be ordered by increasing hcenter().
//
void Track::set_track( const std::vector< Rectangle > & rectangle_vector )
  {
  if( data.size() ) data.clear();
  if( !rectangle_vector.size() ) return;
  std::vector< Rectangle > tmp;
  int max_gap = 0;
  bool last = false;

  {
  int s1 = rectangle_vector[0].width(), s2 = 0;
  for( unsigned i = 1; i < rectangle_vector.size(); ++i )
    {
    s1 += rectangle_vector[i].width();
    s2 += ( rectangle_vector[i].left() - rectangle_vector[i-1].right() );
    }
  max_gap = ( 5 * std::max( s1, s2 ) ) / rectangle_vector.size();
  }

  for( unsigned i = 0; i < rectangle_vector.size(); ++i )
    {
    const Rectangle & r1 = rectangle_vector[i];
    tmp.push_back( r1 );
    if( i + 1 >= rectangle_vector.size() ) last = true;
    else
      {
      const Rectangle & r2 = rectangle_vector[i+1];
      if( r2.left() - r1.right() >= max_gap ) last = true;
      }
    if( last )
      { last = false; data.push_back( set_partial_track( tmp ) ); tmp.clear(); }
    }

  for( unsigned i = 0; i + 1 < data.size(); ++i )
    {
    const Vrhomboid & v1 = data[i];
    const Vrhomboid & v2 = data[i+1];
    if( v1.right() + 1 < v2.left() )
      {
      Vrhomboid v( v1.right() + 1, v1.rvcenter(), v2.left() - 1, v2.lvcenter(),
                   ( v1.height() + v2.height() ) / 2 );
      ++i; data.insert( data.begin() + i, v );
      }
    }
  }


int Track::bottom( const int col ) const
  {
  for( unsigned i = 0; i < data.size(); ++i )
    {
    const Vrhomboid & vr = data[i];
    if( col <= vr.right() || i >= data.size() - 1 ) return vr.bottom( col );
    }
  return 0;
  }


int Track::top( const int col ) const
  {
  for( unsigned i = 0; i < data.size(); ++i )
    {
    const Vrhomboid & vr = data[i];
    if( col <= vr.right() || i >= data.size() - 1 ) return vr.top( col );
    }
  return 0;
  }


int Track::vcenter( const int col ) const
  {
  for( unsigned i = 0; i < data.size(); ++i )
    {
    const Vrhomboid & vr = data[i];
    if( col <= vr.right() || i >= data.size() - 1 ) return vr.vcenter( col );
    }
  return 0;
  }


bool Track::includes( const Rectangle & r ) const
  {
  for( unsigned i = 0; i < data.size(); ++i )
    if( data[i].includes( r ) ) return true;
  if( !data.size() ) return false;
  if( r.right() > data.back().right() )
    {
    Vrhomboid tmp = data.back();
    tmp.extend_right( r.right() );
    return tmp.includes( r );
    }
  if( r.left() < data.front().left() )
    {
    Vrhomboid tmp = data.front();
    tmp.extend_left( r.left() );
    return tmp.includes( r );
    }
  return false;
  }


bool Track::includes( const int row, const int col ) const
  {
  for( unsigned i = 0; i < data.size(); ++i )
    if( data[i].includes( row, col ) ) return true;
  if( !data.size() ) return false;
  if( col > data.back().right() )
    {
    Vrhomboid tmp = data.back();
    tmp.extend_right( col );
    return tmp.includes( row, col );
    }
  if( col < data.front().left() )
    {
    Vrhomboid tmp = data.front();
    tmp.extend_left( col );
    return tmp.includes( row, col );
    }
  return false;
  }
