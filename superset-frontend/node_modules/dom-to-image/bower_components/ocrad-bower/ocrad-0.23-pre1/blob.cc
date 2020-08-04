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
#include <stdint.h>

#include "common.h"
#include "rectangle.h"
#include "bitmap.h"
#include "blob.h"


namespace {

void delete_hole( std::vector< Bitmap * > & holep_vector,
                  std::vector< Bitmap * > & v1,
                  std::vector< Bitmap * > & v2,
                  Bitmap * const p, int i )
  {
  std::replace( v1.begin() + i, v1.end(), p, (Bitmap *) 0 );
  std::replace( v2.begin(), v2.begin() + i, p, (Bitmap *) 0 );

  i = holep_vector.size();
  while( --i >= 0 && holep_vector[i] != p ) ;
  if( i < 0 ) Ocrad::internal_error( "delete_hole, lost hole." );
  holep_vector.erase( holep_vector.begin() + i );
  delete p;
  }


inline void join_holes( std::vector< Bitmap * > & holep_vector,
                        std::vector< Bitmap * > & v1,
                        std::vector< Bitmap * > & v2,
                        Bitmap * p1, Bitmap * p2, int i )
  {
  if( p1->top() > p2->top() )
    {
    Bitmap * const temp = p1; p1 = p2; p2 = temp;
    std::replace( v2.begin(), v2.begin() + ( i + 1 ), p2, p1 );
    }
  else std::replace( v1.begin() + i, v1.end(), p2, p1 );

  i = holep_vector.size();
  while( --i >= 0 && holep_vector[i] != p2 ) ;
  if( i < 0 ) Ocrad::internal_error( "join_holes, lost hole" );
  holep_vector.erase( holep_vector.begin() + i );

  p1->add_bitmap( *p2 );
  delete p2;
  }


void delete_outer_holes( const Rectangle & re,
                         std::vector< Bitmap * > & holepv )
  {
  for( int i = holepv.size() - 1; i >= 0; --i )
    {
    Bitmap & h = *holepv[i];
    if( !re.strictly_includes( h ) )
      { delete &h; holepv.erase( holepv.begin() + i ); }
    }
  }

} // end namespace


Blob::Blob( const Blob & b )
  : Bitmap( b ), holepv( b.holepv )
  {
  for( unsigned i = 0; i < holepv.size(); ++i )
    holepv[i] = new Bitmap( *b.holepv[i] );
  }


Blob & Blob::operator=( const Blob & b )
  {
  if( this != &b )
    {
    Bitmap::operator=( b );
    for( unsigned i = 0; i < holepv.size(); ++i ) delete holepv[i];
    holepv = b.holepv;
    for( unsigned i = 0; i < holepv.size(); ++i )
      holepv[i] = new Bitmap( *b.holepv[i] );
    }
  return *this;
  }


Blob::~Blob()
  {
  for( unsigned i = 0; i < holepv.size(); ++i ) delete holepv[i];
  }


void Blob::left( const int l )
  {
  const int d = l - left();
  if( d ) { Bitmap::left( l ); if( d > 0 ) delete_outer_holes( *this, holepv ); }
  }


void Blob::top( const int t )
  {
  const int d = t - top();
  if( d ) { Bitmap::top( t ); if( d > 0 ) delete_outer_holes( *this, holepv ); }
  }


void Blob::right( const int r )
  {
  const int d = r - right();
  if( d ) { Bitmap::right( r ); if( d < 0 ) delete_outer_holes( *this, holepv ); }
  }


void Blob::bottom( const int b )
  {
  const int d = b - bottom();
  if( d ) { Bitmap::bottom( b ); if( d < 0 ) delete_outer_holes( *this, holepv ); }
  }


const Bitmap & Blob::hole( const int i ) const
  {
  if( i < 0 || i >= holes() )
    Ocrad::internal_error( "hole, index out of bounds" );
  return *holepv[i];
  }


int Blob::id( const int row, const int col ) const
  {
  if( this->includes( row, col ) )
    {
    if( get_bit( row, col ) ) return 1;
    for( int i = 0; i < holes(); ++i )
      if( holepv[i]->includes( row, col ) && holepv[i]->get_bit( row, col ) )
        return -( i + 1 );
    }
  return 0;
  }


bool Blob::test_BD() const
  {
  const int wlimit = std::min( height(), width() ) / 2;
  int lb = wlimit, rt = wlimit;			// index of first dot found
  for( int i = 0; i < wlimit; ++i )
    if( id( bottom() - i, left() + i ) == 1 ||
        id( bottom() - i, left() + i + 1 ) == 1 )
      { lb = i; break; }
  for( int i = 0; i < wlimit; ++i )
    if( id( top() + i, right() - i ) == 1 )
      { rt = i; break; }
  return ( rt >= 2 && 3 * lb <= rt );
  }


bool Blob::test_Q() const
  {
  const int wlimit = std::min( height(), width() ) / 2;
  int ltwmax = 0, rbwmax = 0;
  int ltimin = wlimit, rbimin = wlimit;		// index of first dot found
  for( int disp = 0; disp < width() / 4; ++disp )
    {
    int ltw = 0, rbw = 0;
    for( int i = 0; i < wlimit; ++i )
      {
      if( id( top() + i, left() + disp + i ) == 1 )
        { ++ltw; if( ltimin > i ) ltimin = i; }
      if( id( bottom() - i, right() - disp - i ) == 1 )
        { ++rbw; if( rbimin > i ) rbimin = i; }
      }
    if( ltwmax < ltw ) ltwmax = ltw;
    if( rbwmax < rbw ) rbwmax = rbw;
    }
  return ( ( ltimin > rbimin || rbimin == 0 ) &&
           ( 2 * ltwmax < rbwmax || ( 2 * ltwmax == rbwmax && rbwmax >= 4 ) ) );
  }


void Blob::print( FILE * const outfile ) const
  {
  for( int row = top(); row <= bottom(); ++row )
    {
    for( int col = left(); col <= right(); ++col )
      {
      if( get_bit( row, col ) ) std::fprintf( outfile, " O" );
      else std::fprintf( outfile, " ." );
      }
    std::fputs( "\n", outfile );
    }
  std::fputs( "\n", outfile );
  }


void Blob::fill_hole( const int i )
  {
  if( i < 0 || i >= holes() )
    Ocrad::internal_error( "fill_hole, index out of bounds" );
  add_bitmap( *holepv[i] );
  delete holepv[i];
  holepv.erase( holepv.begin() + i );
  }


void Blob::find_holes()
  {
  for( unsigned i = 0; i < holepv.size(); ++i ) delete holepv[i];
  holepv.clear();
  if( height() < 3 || width() < 3 ) return;

  std::vector< Bitmap * > old_data( width(), (Bitmap *) 0 );
  std::vector< Bitmap * > new_data( width(), (Bitmap *) 0 );

  for( int row = top(); row <= bottom(); ++row )
    {
    old_data.swap( new_data );
    new_data[0] = get_bit( row, left() ) ? this : 0;
    for( int col = left() + 1; col < right(); ++col )
      {
      const int dcol = col - left();
      if( get_bit( row, col ) ) new_data[dcol] = this;	// black pixel
      else						// white pixel
        {
        Bitmap *p;
        Bitmap *lp = new_data[dcol-1];
        Bitmap *tp = old_data[dcol];
        if( lp == 0 || tp == 0 )
          {
          p = 0;
          if( lp && lp != this )
            delete_hole( holepv, old_data, new_data, lp, dcol );
          else if( tp && tp != this )
            delete_hole( holepv, old_data, new_data, tp, dcol );
          }
        else if( lp != this ) { p = lp; p->add_point( row, col ); }
        else if( tp != this ) { p = tp; p->add_point( row, col ); }
        else
          {
          p = new Bitmap( col, row, col, row );
          p->set_bit( row, col, true );
          holepv.push_back( p );
          }
        new_data[dcol] = p;
        if( p && lp != tp && lp != this && tp != this )
          join_holes( holepv, old_data, new_data, lp, tp, dcol );
        }
      }
    if( !get_bit( row, right() ) )
      {
      Bitmap *lp = new_data[width()-2];
      if( lp && lp != this )
        delete_hole( holepv, old_data, new_data, lp, width() - 1 );
      }
    }

  for( int i = holepv.size() - 1; i >= 0; --i )	// FIXME noise holes removal
    {
    Bitmap & h = *holepv[i];
    if( this->strictly_includes( h ) &&
        ( h.height() > 4 || h.width() > 4 ||
          ( ( h.height() > 2 || h.width() > 2 ) && h.area() > 3 ) ) )
      continue;
    delete &h; holepv.erase( holepv.begin() + i );
    }
/*
  for( int i = holepv.size() - 1; i >= 0; --i )
    {
    Bitmap & h = *holepv[i];
    if( !this->strictly_includes( h ) )
      { delete &h; holepv.erase( holepv.begin() + i ); }
    if( 20 * h.height() < height() && 16 * h.width() < width() ) fill_hole( i );
//    else if( h.height() < 2 && h.width() < 2 && h.area() < 2 )
//      { delete &h; holepv.erase( holepv.begin() + i ); }
    }
*/
  }
