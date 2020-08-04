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
#include "segment.h"
#include "ucs.h"
#include "bitmap.h"
#include "blob.h"
#include "profile.h"
#include "feats.h"


Features::Features( const Blob & b_ )
  : b( b_ ), hbars_( -1 ), vbars_( -1 ),
    lp( b, Profile::left ),
    tp( b, Profile::top ), rp( b, Profile::right ), bp( b, Profile::bottom ),
    hp( b, Profile::height ), wp( b, Profile::width )
  {}


int Features::hbars() const
  {
  if( hbars_ < 0 )
    {
    const int limit = wp.max() / 2;
    int state = 0, begin = 0, l = 0, r = 0;
    std::vector< int > count( b.height(), 0 );
    hbars_ = 0;

    for( int row = b.top(); row <= b.bottom(); ++row )
      {
      int col, c = 0, lt = 0, rt = 0, x = 0;
      int & maxcount = count[row-b.top()];
      for( col = b.left(); col <= b.right(); ++col )
        {
        if( b.get_bit( row, col ) )
          { ++c; x = col; if( col < b.right() ) continue; }
        if( c > maxcount ) { maxcount = c; rt = x; lt = rt - c + 1; }
        c = 0;
        }
      switch( state )
        {
        case 0: if( maxcount > limit )
                  { state = 1; begin = row; l = lt; r = rt; }
                else break;
        case 1: if( maxcount > limit )
                  {
                  if( lt < l ) l = lt;
                  if( rt > r ) r = rt;
                  if( row < b.bottom() ) break;
                  }
                state = 0;
                int end = ( maxcount <= limit ) ? row - 1 : row;
                const int width = r - l + 1;
                while( begin <= end && 3 * count[begin-b.top()] < 2 * width )
                  ++begin;
                while( begin <= end && 3 * count[end-b.top()] < 2 * width )
                  --end;
                const int height = end - begin + 1;
                if( height < 1 || 2 * height > 3 * width ) break;
                hbar_.push_back( Rectangle( l, begin, r, end ) );
                ++hbars_; break;
        }
      }
    }
  return hbars_;
  }


int Features::vbars() const		// FIXME small gaps not detected
  {
  if( vbars_ < 0 )
    {
    int state = 0, begin = 0, limit = b.height();
    limit -= ( b.height() < 40 ) ? 3 : b.height() / 10;
    vbars_ = 0;

    for( int col = b.left(); col <= b.right(); ++col )
      {
      int c = 0, c2 = 0, count = 0;
      for( int row = b.top() + 1; row < b.bottom(); ++row )
        {
        if( b.get_bit( row, col ) )
          { ++c; if( row < b.bottom() - 1 ) continue; }
        else if( ( col > b.left() && b.get_bit( row, col - 1 ) ) ||
                 ( col < b.right() && b.get_bit( row, col + 1 ) ) )
          { ++c; ++c2; if( row < b.bottom() - 1 ) continue; }
        if( c > count ) { count = c; } c = 0;
        }
      if( ( count - c2 ) * 3 < limit * 2 ) count = 0;
      switch( state )
        {
        case 0: if( count >= limit ) { state = 3; begin = col; }
                else if( count * 4 >= limit * 3 ) { state = 2; begin = col; }
                else if( count * 3 >= limit * 2 ) { state = 1; begin = col; }
                break;
        case 1: if( count >= limit ) state = 3;
                else if( count * 4 >= limit * 3 ) state = 2;
                else if( count * 3 < limit * 2 ) state = 0;
                else begin = col;
                break;
        case 2: if( count >= limit ) state = 3;
                else if( count * 3 < limit * 2 ) state = 0;
                else if( count * 4 < limit * 3 ) state = 1;
                break;
        case 3: if( count * 3 < limit * 2 || col == b.right() )
                  {
                  int end = ( count * 3 < limit * 2 ) ? col - 1 : col;
                  vbar_.push_back( Rectangle( begin, b.top(), end, b.bottom() ) );
                  ++vbars_; state = 0;
                  }
        }
      }
    }
  return vbars_;
  }


// return the number of vertical traces crossing every row
//
int Features::segments_in_row( const int row ) const
  {
  if( row_scan.size() == 0 )
    {
    int l = -1;			// begin of segment. -1 means no segment
    row_scan.resize( b.height() );

    for( int row = b.top(); row <= b.bottom(); ++row )
      for( int col = b.left(); col <= b.right(); ++col )
        {
        bool black = b.get_bit( row, col );
        if( l < 0 && black ) l = col;			// begin of segment
        if( l >= 0 && ( !black || col == b.right() ) )	// end of segment
          { row_scan[row-b.top()].push_back( Csegment( l, col - !black ) );
            l = -1; }
        }
    }
  return row_scan[row-b.top()].size();
  }


// return the number of horizontal traces crossing every column
//
int Features::segments_in_col( const int col ) const
  {
  if( col_scan.size() == 0 )
    {
    int t = -1;			// begin of segment. -1 means no segment
    col_scan.resize( b.width() );

    for( int col = b.left(); col <= b.right(); ++col )
      for( int row = b.top(); row <= b.bottom(); ++row )
        {
        bool black = b.get_bit( row, col );
        if( t < 0 && black ) t = row;			// begin of segment
        if( t >= 0 && ( !black || row == b.bottom() ) )	// end of segment
          { col_scan[col-b.left()].push_back( Csegment( t, row - !black ) );
            t = -1; }
        }
    }
  return col_scan[col-b.left()].size();
  }


// return the column segment containing the point (row,col) if any
//
Csegment Features::col_segment( const int row, const int col ) const
  {
  const int segments = segments_in_col( col );
  for( int i = 0; i < segments; ++i )
    if( col_scan[col-b.left()][i].includes( row ) )
      return col_scan[col-b.left()][i];
  return Csegment();
  }


int Features::test_misc( const Rectangle & charbox ) const
  {
  if( bp.minima() == 1 )
    {
    if( hbars() == 1 && hbar(0).top() <= b.top() + ( b.height() / 10 ) &&
        4 * hbar(0).height() <= b.height() &&
        5 * hbar(0).width() >= 4 * b.width() &&
        rp[hbar(0).bottom()-b.top()+2] - rp[hbar(0).bottom()-b.top()] < b.width() / 4 &&
        rp.increasing( hbar(0).vcenter() - b.top() + 1 ) )
      return '7';

    if( b.height() > b.width() && rp.increasing() && !tp.decreasing() &&
        b.seek_left( b.vcenter(), b.hcenter() ) <= b.left() )
      return '7';
    }

  if( tp.minima( b.height() / 4 ) == 1 && bp.minima( b.height() / 4 ) == 1 )
    {
    if( b.height() > 2 * b.width() && rp.increasing() &&
        tp.decreasing() && lp.iscpit( 25 ) )
      return '1';

    if( hbars() == 1 ||
        ( hbars() == 2 && hbar(1).bottom() >= b.bottom() - 1 &&
        3 * hbar(0).width() > 4 * hbar(1).width() ) )
      if( 3 * hbar(0).height() < b.height() && hbar(0).top() <= b.top() + 1 )
        {
        int i = lp.pos( 40 );
        if( 3 * wp[i] < b.width() && 5 * lp[i] > b.width() &&
            5 * rp[i] > b.width() ) return 'T';
        }

    if( 3 * b.height() > 4 * b.width() &&
        vbars() == 1 && vbar(0).width() >= 2 )
      {
      const int lg = vbar(0).left() - b.left();
      const int rg = b.right() - vbar(0).right();
      if( 2 * lg < b.width() && 2 * rg < b.width() &&
          Ocrad::similar( lg, rg, 40 ) &&
          4 * bp[bp.pos(25)] > 3 * b.height() &&
          4 * tp[tp.pos(75)] > 3 * b.height() )
        return 'l';
      }

    if( 5 * b.height() >= 4 * charbox.height() && b.height() > wp.max() &&
        3 * wp[wp.pos(50)] < b.width() )
      {
      if( hbars() == 1 && hbar(0).bottom() >= b.bottom() - 1 &&
          hbar(0).top() > b.vpos( 75 ) &&
          Ocrad::similar( lp[lp.pos(50)], rp[rp.pos(50)], 20, 2 ) )
        return 'l';
      if( hbars() == 2 && hbar(0).bottom() < b.vpos( 25 ) &&
          hbar(1).top() > b.vpos( 75 ) &&
          hbar(1).bottom() >= b.bottom() - 1 /*&&
          3 * hbar(0).width() < 4 * hbar(1).width()*/ )
        {
        if( hbar(0).right() <= hbar(1).hcenter() ) return 0;
        if( 3 * hbar(0).width() <= 2 * hbar(1).width() ||
            b.height() >= 3 * wp.max() ) return 'l';
        return 'I';
        }
      }

    if( ( hbars() == 2 || hbars() == 3 ) && hbar(0).top() <= b.top() + 1 &&
        hbar(1).includes_vcenter( b ) &&
        3 * hbar(0).width() > 4 * hbar(1).width() &&
        ( hbars() == 2 ||
          ( hbar(2).bottom() >= b.bottom() - 1 &&
            3 * hbar(0).width() > 4 * hbar(2).width() ) ) ) return 'F';

    if( b.height() > 3 * wp.max() )
      {
      if( rp.istip() && lp.ispit() )
        { if( lp.istpit() ) return '{'; else return '('; }
      if( lp.istip() && rp.ispit() )
        { if( rp.istpit() ) return '}'; else return ')'; }
      if( b.width() > 2 * wp.max() && rp.isconvex() ) return ')';
      }

    if( b.height() > 2 * b.width() && 5 * b.height() >= 4 * charbox.height() &&
        lp.max() + rp.max() < b.width() )
      return '|';
    }

  return 0;
  }
