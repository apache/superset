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
#include <cstddef>
#include <cstdio>
#include <cstdlib>

#include "common.h"
#include "rectangle.h"


namespace {

void error( const char * const msg )
  { Ocrad::internal_error( msg ); }

} // end namespace


Rectangle::Rectangle( const int l, const int t, const int r, const int b )
  {
  if( r < l || b < t )
    {
    if( verbosity >= 0 )
      std::fprintf( stderr, "l = %d, t = %d, r = %d, b = %d\n", l, t, r, b );
    error( "bad parameter building a Rectangle" );
    }
  left_ = l; top_ = t; right_ = r; bottom_ = b;
  }


void Rectangle::left( const int l )
  {
  if( l > right_ ) error( "left, bad parameter resizing a Rectangle" );
  left_ = l;
  }


void Rectangle::top( const int t )
  {
  if( t > bottom_ ) error( "top, bad parameter resizing a Rectangle" );
  top_ = t;
  }


void Rectangle::right( const int r )
  {
  if( r < left_ ) error( "right, bad parameter resizing a Rectangle" );
  right_ = r;
  }


void Rectangle::bottom( const int b )
  {
  if( b < top_ ) error( "bottom, bad parameter resizing a Rectangle" );
  bottom_ = b;
  }


void Rectangle::height( const int h )
  {
  if( h <= 0 ) error( "height, bad parameter resizing a Rectangle" );
  bottom_ = top_ + h - 1;
  }


void Rectangle::width( const int w )
  {
  if( w <= 0 ) error( "width, bad parameter resizing a Rectangle" );
  right_ = left_ + w - 1;
  }


void Rectangle::add_point( const int row, const int col )
  {
  if( row > bottom_ ) bottom_ = row; else if( row < top_ ) top_ = row;
  if( col > right_ ) right_ = col;   else if( col < left_ ) left_ = col;
  }


void Rectangle::add_rectangle( const Rectangle & re )
  {
  if( re.left_ < left_ )     left_ = re.left_;
  if( re.top_ < top_ )       top_ = re.top_;
  if( re.right_ > right_ )   right_ = re.right_;
  if( re.bottom_ > bottom_ ) bottom_ = re.bottom_;
  }


void Rectangle::enlarge( const int scale )
  {
  if( scale > 1 )
    { left_ *= scale; top_ *= scale; right_ *= scale; bottom_ *= scale; }
  }


void Rectangle::move( const int row, const int col )
  {
  int d = row - top_; if( d ) { top_ += d; bottom_ += d; }
  d = col - left_; if( d ) { left_ += d; right_ += d; }
  }


bool Rectangle::includes( const Rectangle & re ) const
  {
  return ( left_  <= re.left_  && top_    <= re.top_ &&
           right_ >= re.right_ && bottom_ >= re.bottom_ );
  }


bool Rectangle::includes( const int row, const int col ) const
  {
  return ( left_ <= col && right_ >= col && top_ <= row && bottom_ >= row );
  }


bool Rectangle::strictly_includes( const Rectangle & re ) const
  {
  return ( left_  < re.left_  && top_    < re.top_ &&
           right_ > re.right_ && bottom_ > re.bottom_ );
  }


bool Rectangle::strictly_includes( const int row, const int col ) const
  {
  return ( left_ < col && right_ > col && top_ < row && bottom_ > row );
  }


bool Rectangle::includes_hcenter( const Rectangle & re ) const
  { return ( left_ <= re.hcenter() && right_ >= re.hcenter() ); }


bool Rectangle::includes_vcenter( const Rectangle & re ) const
  { return ( top_ <= re.vcenter() && bottom_ >= re.vcenter() ); }


bool Rectangle::h_includes( const Rectangle & re ) const
  { return ( left_ <= re.left_ && right_ >= re.right_ ); }


bool Rectangle::v_includes( const Rectangle & re ) const
  { return ( top_ <= re.top_ && bottom_ >= re.bottom_ ); }


bool Rectangle::h_includes( const int col ) const
  { return ( left_ <= col && right_ >= col ); }


bool Rectangle::v_includes( const int row ) const
  { return ( top_ <= row && bottom_ >= row ); }


bool Rectangle::h_overlaps( const Rectangle & re ) const
  { return ( left_ <= re.right_ && right_ >= re.left_ ); }


bool Rectangle::v_overlaps( const Rectangle & re ) const
  { return ( top_ <= re.bottom_ && bottom_ >= re.top_ ); }


int Rectangle::v_overlap_percent( const Rectangle & re ) const
  {
  int ov = std::min( bottom_, re.bottom_ ) - std::max( top_, re.top_ ) + 1;
  if( ov > 0 )
    ov = std::max( 1, ( ov * 100 ) / std::min( height(), re.height() ) );
  else ov = 0;
  return ov;
  }


bool Rectangle::is_hcentred_in( const Rectangle & re ) const
  {
  if( this->h_includes( re.hcenter() ) ) return true;
  int w = std::min( re.height(), re.width() ) / 2;
  if( width() < w )
    {
    int d = ( w + 1 ) / 2;
    if( hcenter() - d <= re.hcenter() && hcenter() + d >= re.hcenter() )
      return true;
    }
  return false;
  }


bool Rectangle::is_vcentred_in( const Rectangle & re ) const
  {
  if( this->v_includes( re.vcenter() ) ) return true;
  int h = std::min( re.height(), re.width() ) / 2;
  if( height() < h )
    {
    int d = ( h + 1 ) / 2;
    if( vcenter() - d <= re.vcenter() && vcenter() + d >= re.vcenter() )
      return true;
    }
  return false;
  }


bool Rectangle::precedes( const Rectangle & re ) const
  {
  if( right_ < re.left_ ) return true;
  if( this->h_overlaps( re ) &&
      ( ( top_ < re.top_ ) || ( top_ == re.top_ && left_ < re.left_ ) ) )
    return true;
  return false;
  }


bool Rectangle::h_precedes( const Rectangle & re ) const
  { return ( hcenter() < re.hcenter() ); }


bool Rectangle::v_precedes( const Rectangle & re ) const
  {
  if( bottom_ < re.vcenter() || vcenter() < re.top_ ) return true;
  if( this->includes_vcenter( re ) && re.includes_vcenter( *this ) )
    return this->h_precedes( re );
  return false;
  }


int Rectangle::distance( const Rectangle & re ) const
  { return hypoti( h_distance( re ), v_distance( re ) ); }


int Rectangle::distance( const int row, const int col ) const
  { return hypoti( h_distance( col ), v_distance( row ) ); }


int Rectangle::h_distance( const Rectangle & re ) const
  {
  if( re.right_ <= left_ ) return left_ - re.right_;
  if( re.left_ >= right_ ) return re.left_ - right_;
  return 0;
  }

int Rectangle::h_distance( const int col ) const
  {
  if( col <= left_ ) return left_ - col;
  if( col >= right_ ) return col - right_;
  return 0;
  }

int Rectangle::v_distance( const Rectangle & re ) const
  {
  if( re.bottom_ <= top_ ) return top_ - re.bottom_;
  if( re.top_ >= bottom_ ) return re.top_ - bottom_;
  return 0;
  }

int Rectangle::v_distance( const int row ) const
  {
  if( row <= top_ ) return top_ - row;
  if( row >= bottom_ ) return row - bottom_;
  return 0;
  }


int Rectangle::hypoti( const int c1, const int c2 )
  {
  long long temp = c1; temp *= temp;
  long long target = c2; target *= target; target += temp;
  int lower = std::max( std::abs(c1), std::abs(c2) );
  int upper = std::abs(c1) + std::abs(c2);
  while( upper - lower > 1 )
    {
    int m = ( lower + upper ) / 2;
    temp = m; temp *= temp;
    if( temp < target ) lower = m; else upper = m;
    }
  temp = lower; temp *= temp; target *= 2; target -= temp;
  temp = upper; temp *= temp;
  if( target < temp ) return lower;
  else return upper;
  }
