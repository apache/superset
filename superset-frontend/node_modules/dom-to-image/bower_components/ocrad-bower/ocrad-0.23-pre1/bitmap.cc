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
#include <cctype>
#include <cstdio>
#include <vector>
#include <stdint.h>

#include "common.h"
#include "rectangle.h"
#include "bitmap.h"


    // Creates a blank Bitmap
Bitmap::Bitmap( const int l, const int t, const int r, const int b )
  : Rectangle( l, t, r, b ), data( height() )
  {
  for( int row = 0; row < height(); ++row )
    data[row].resize( width(), false );
  }


    // Creates a Bitmap from part of another Bitmap
Bitmap::Bitmap( const Bitmap & source, const Rectangle & re )
  : Rectangle( re ), data( re.height() )
  {
  if( !source.includes( re ) )
    Ocrad::internal_error( "bad parameter building a Bitmap from part of another one" );

  const int ldiff = left()-source.left();
  const int tdiff = top()-source.top();

  for( int row = 0; row < height(); ++row )
    {
    data[row].resize( width() );
    std::vector< uint8_t > & datarow = data[row];
    const std::vector< uint8_t > & datarow2 = source.data[row+tdiff];
    for( int col = 0; col < width(); ++col )
      datarow[col] = datarow2[col+ldiff];
    }
  }


void Bitmap::left( const int l )
  {
  if( l == left() ) return;
  if( l < left() )
    for( int row = height() - 1; row >= 0 ; --row )
      data[row].insert( data[row].begin(), left() - l, false );
  else
    for( int row = height() - 1; row >= 0 ; --row )
      data[row].erase( data[row].begin(), data[row].begin() + ( l - left() ) );
  Rectangle::left( l );
  }


void Bitmap::top( const int t )
  {
  if( t == top() ) return;
  if( t < top() )
    data.insert( data.begin(), top() - t,
                 std::vector< uint8_t >( width(), false ) );
  else
    data.erase( data.begin(), data.begin() + ( t - top() ) );
  Rectangle::top( t );
  }


void Bitmap::right( const int r )
  {
  if( r == right() ) return;
  Rectangle::right( r );
  for( int row = height() - 1; row >= 0 ; --row )
    data[row].resize( width(), false );
  }


void Bitmap::bottom( const int b )
  {
  if( b == bottom() ) return;
  int old_height = height();
  Rectangle::bottom( b );
  data.resize( height() );
  for( int row = old_height; row < height(); ++row )
    data[row].resize( width(), false );
  }


void Bitmap::add_bitmap( const Bitmap & bm )
  {
  add_rectangle( bm );
  for( int row = bm.top(); row <= bm.bottom(); ++row )
    for( int col = bm.left(); col <= bm.right(); ++col )
      if( bm.get_bit( row, col ) ) set_bit( row, col, true );
  }


void Bitmap::add_point( const int row, const int col )
  {
  if( col > right() ) right( col ); else if( col < left() ) left( col );
  if( row > bottom() ) bottom( row ); else if( row < top() ) top( row );
  set_bit( row, col, true );
  }


void Bitmap::add_rectangle( const Rectangle & re )
  {
  if( re.left() < left() )     left( re.left() );
  if( re.top() < top() )       top( re.top() );
  if( re.right() > right() )   right( re.right() );
  if( re.bottom() > bottom() ) bottom( re.bottom() );
  }


// Returns false if bitmap is empty
//
bool Bitmap::adjust_height()
  {
  int row1, row2;

  for( row1 = top(); row1 <= bottom(); ++row1 )
    for( int col = left(); col <= right(); ++col )
      if( get_bit( row1, col ) ) goto L1;
  L1:
  for( row2 = bottom(); row2 >= row1; --row2 )
    for( int col = left(); col <= right(); ++col )
      if( get_bit( row2, col ) ) goto L2;
  L2:
  if( row1 > row2 ) return false;
  if( row1 > top() ) top( row1 );
  if( row2 < bottom() ) bottom( row2 );
  return true;
  }


// Returns false if bitmap is empty
//
bool Bitmap::adjust_width()
  {
  int col1, col2;

  for( col1 = left(); col1 <= right(); ++col1 )
    for( int row = top(); row <= bottom(); ++row )
      if( get_bit( row , col1 ) ) goto L1;
  L1:
  for( col2 = right(); col2 >= col1; --col2 )
    for( int row = top(); row <= bottom(); ++row )
      if( get_bit( row , col2) ) goto L2;
  L2:
  if( col1 >= col2 ) return false;
  if( col1 > left() ) left( col1 );
  if( col2 < right() ) right( col2 );
  return true;
  }


// Return the total filled area of this Bitmap
//
int Bitmap::area() const
  {
  int a = 0;

  for( int row = top(); row <= bottom(); ++row )
    for( int col = left(); col <= right(); ++col )
      if( get_bit( row, col ) ) ++a;

  return a;
  }


// Return the central octagon filled area of this Bitmap
//
int Bitmap::area_octagon() const
  {
  int a = 0;
  int bevel = ( 29 * std::min( height(), width() ) ) / 100;
  int l =  left() + bevel;
  int r = right() - bevel;

  for( int i = 0; i < bevel; ++i )
    for( int row = top() + i, col = l - i; col <= r + i; ++col )
      if( get_bit( row, col ) ) ++a;

  for( int row = top() + bevel; row <= bottom() - bevel; ++row )
    for( int col = left(); col <= right(); ++col )
      if( get_bit( row, col ) ) ++a;

  for( int i = bevel - 1; i >= 0; --i )
    for( int row = bottom() - i, col = l - i; col <= r + i; ++col )
      if( get_bit( row, col ) ) ++a;

  return a;
  }


// Return the size of the central octagon of this blob
//
int Bitmap::size_octagon() const
  {
  int bevel = ( 29 * std::min( height(), width() ) ) / 100;
  return size() - ( 2 * bevel * ( bevel + 1 ) );
  }


int Bitmap::seek_left( const int row, const int col, const bool black ) const
  {
  int c = col;
  while( c > left() && get_bit( row, c - 1 ) != black ) --c;
  return c;
  }


int Bitmap::seek_top( const int row, const int col, const bool black ) const
  {
  int r = row;
  while( r > top() && get_bit( r - 1, col ) != black ) --r;
  return r;
  }


int Bitmap::seek_right( const int row, const int col, const bool black ) const
  {
  int c = col;
  while( c < right() && get_bit( row, c + 1 ) != black ) ++c;
  return c;
  }


int Bitmap::seek_bottom( const int row, const int col, const bool black ) const
  {
  int r = row;
  while( r < bottom() && get_bit( r + 1, col ) != black ) ++r;
  return r;
  }


bool Bitmap::escape_left( int row, int col ) const
  {
  if( get_bit( row, col ) ) return false;
  int u, d;

  for( u = row; u > top() + 1; --u ) if( get_bit( u - 1, col ) ) break;
  for( d = row; d < bottom() - 1; ++d ) if( get_bit( d + 1, col ) ) break;
  while( u <= d && --col >= left() )
    {
    if( u > top() + 1 && !get_bit( u, col ) ) --u;
    if( d < bottom() - 1 && !get_bit( d, col ) ) ++d;
    while( u <= d && get_bit( u, col ) ) ++u;
    while( u <= d && get_bit( d, col ) ) --d;
    }
  return ( col < left() );
  }


bool Bitmap::escape_top( int row, int col ) const
  {
  if( get_bit( row, col ) ) return false;
  int l, r;

  for( l = col; l > left() + 1; --l ) if( get_bit( row, l - 1 ) ) break;
  for( r = col; r < right() - 1; ++r ) if( get_bit( row, r + 1 ) ) break;
  while( l <= r && --row >= top() )
    {
    if( l > left() + 1 && !get_bit( row, l ) ) --l;
    if( r < right() - 1 && !get_bit( row, r ) ) ++r;
    while( l <= r && get_bit( row, l ) ) ++l;
    while( l <= r && get_bit( row, r ) ) --r;
    }
  return ( row < top() );
  }


bool Bitmap::escape_right( int row, int col ) const
  {
  if( get_bit( row, col ) ) return false;
  int u, d;

  for( u = row; u > top() + 1; --u ) if( get_bit( u - 1, col ) ) break;
  for( d = row; d < bottom() - 1; ++d ) if( get_bit( d + 1, col ) ) break;
  while( u <= d && ++col <= right() )
    {
    if( u > top() + 1 && !get_bit( u, col ) ) --u;
    if( d < bottom() - 1 && !get_bit( d, col ) ) ++d;
    while( u <= d && get_bit( u, col ) ) ++u;
    while( u <= d && get_bit( d, col ) ) --d;
    }
  return ( col > right() );
  }


bool Bitmap::escape_bottom( int row, int col ) const
  {
  if( get_bit( row, col ) ) return false;
  int l, r;

  for( l = col; l > left() + 1; --l ) if( get_bit( row, l - 1 ) ) break;
  for( r = col; r < right() - 1; ++r ) if( get_bit( row, r + 1 ) ) break;
  while( l <= r && ++row <= bottom() )
    {
    if( l > left() + 1 && !get_bit( row, l ) ) --l;
    if( r < right() - 1 && !get_bit( row, r ) ) ++r;
    while( l <= r && get_bit( row, l ) ) ++l;
    while( l <= r && get_bit( row, r ) ) --r;
    }
  return ( row > bottom() );
  }


int Bitmap::follow_top( int row, int col ) const
  {
  if( !get_bit( row, col ) ) return row;
  std::vector< uint8_t > array;
  array.reserve( width() );
  int c;

  for( c = col; c > left() && get_bit( row, c - 1 ); --c ) ;
  if( c > left() ) array.resize( c - left(), false );
  for( c = col; c < right() && get_bit( row, c + 1 ); ++c ) ;
  array.resize( c - left() + 1, true );
  if( c < right() ) array.resize( width(), false );

  while( --row >= top() )
    {
    bool alive = false;
    for( int i = 0; i < width(); ++i ) if( array[i] )
      { if( !get_bit( row, left() + i ) ) array[i] = false;
      else alive = true; }
    if( !alive ) break;

    for( int i = 1; i < width(); ++i )
      if( array[i-1] && !array[i] &&
          get_bit( row, left() + i ) ) array[i] = true;
    for( int i = width() - 2; i >= 0; --i )
      if( array[i+1] && !array[i] &&
          get_bit( row, left() + i ) ) array[i] = true;
    }
  return row + 1;
  }


int Bitmap::follow_bottom( int row, int col ) const
  {
  if( !get_bit( row, col ) ) return row;
  std::vector< uint8_t > array;
  array.reserve( width() );
  int c;

  for( c = col; c > left() && get_bit( row, c - 1 ); --c ) ;
  if( c > left() ) array.resize( c - left(), false );
  for( c = col; c < right() && get_bit( row, c + 1 ); ++c ) ;
  array.resize( c - left() + 1, true );
  if( c < right() ) array.resize( width(), false );

  while( ++row <= bottom() )
    {
    bool alive = false;
    for( int i = 0; i < width(); ++i ) if( array[i] )
      { if( !get_bit( row, left() + i ) ) array[i] = false;
      else alive = true; }
    if( !alive ) break;

    for( int i = 1; i < width(); ++i )
      if( array[i-1] && !array[i] &&
          get_bit( row, left() + i ) ) array[i] = true;
    for( int i = width() - 2; i >= 0; --i )
      if( array[i+1] && !array[i] &&
          get_bit( row, left() + i ) ) array[i] = true;
    }
  return row - 1;
  }


// Looks for an inverted-U-shaped curve near the top, then tests which of
// the vertical bars goes deeper
//
bool Bitmap::top_hook( int *hdiff ) const
  {
  int row, lcol = 0, rcol = 0, black_section = 0, wmax = 0;

  for( row = top() + 1; row < vcenter(); ++row )
    {
    int l = -1, r = -2;
    bool prev_black = false;
    black_section = 0;
    for( int col = left(); col <= right(); ++col )
      {
      bool black = get_bit( row, col );
      if( black )
        {
        if( !prev_black && ++black_section == 2 ) rcol = col;
        r = col; if( l < 0 ) l = col;
        }
      else if( prev_black && black_section == 1 ) lcol = col - 1;
      prev_black = black;
      }
    r = r - l + 1;
    if( 10 * r <= 9 * wmax ) return false;
    if( r > wmax ) wmax = r ;
    if( black_section >= 2 ) break;
    }

  if( black_section != 2 ) return false;
  if( escape_top( row, lcol + 1 ) ) return false;
  int lrow = follow_bottom( row, lcol ), rrow = follow_bottom( row, rcol );
  if( lrow <= row || rrow <= row ) return false;
  if( hdiff ) *hdiff = lrow - rrow;
  return true;
  }


// Looks for an U-shaped curve near the bottom, then tests which of
// the vertical bars is taller
//
bool Bitmap::bottom_hook( int *hdiff ) const
  {
  int row, lcol = 0, rcol = 0, black_section = 0, wmax = 0;

  for( row = bottom(); row > vpos( 80 ); --row )
    {
    int l, r;
    for( l = left(); l <= right(); ++l ) if( get_bit( row, l ) ) break;
    for( r = right(); r > l; --r ) if( get_bit( row, r ) ) break;
    const int w = r - l + 1;
    if( w > wmax ) wmax = w;
    if( 4 * w >= width() )
      {
      int i;
      for( i = l + 1; i < r; ++i ) if( !get_bit( row, i ) ) break;
      if( i >= r ) break;
      }
    }

  if( row > vpos( 80 ) ) while( --row > vcenter() )
    {
    int l = -1, r = -2;
    bool prev_black = false;
    black_section = 0;
    for( int col = left(); col <= right(); ++col )
      {
      bool black = get_bit( row, col );
      if( black )
        {
        if( !prev_black && ++black_section == 2 ) rcol = col;
        r = col; if( l < 0 ) l = col;
        }
      else if( prev_black && black_section == 1 ) lcol = col - 1;
      prev_black = black;
      }
    const int w = r - l + 1;
    if( black_section > 2 || 10 * w <= 8 * wmax ) break;
    if( w > wmax ) wmax = w;
    if( black_section == 2 && rcol - lcol >= 2 )
      {
      if( escape_bottom( row, lcol + 1 ) ) break;
      if( hdiff ) *hdiff = follow_top( row, lcol ) - follow_top( row, rcol );
      return true;
      }
    }
  return false;
  }
