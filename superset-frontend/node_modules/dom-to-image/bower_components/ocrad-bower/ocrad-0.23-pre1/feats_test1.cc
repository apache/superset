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


// Tests if the lower half of character is open to the left, to the right,
// and/or to the bottom
//
int Features::test_49ARegpq( const Rectangle & charbox ) const
  {
  const Bitmap & h = b.hole( 0 );

  if( bp.minima( b.height() / 10 + 1 ) == 2 && bp.isctip() && tp.minima() == 1 )
    { if( tp.isvpit() || rp.decreasing() ) return 'A'; else return 'R'; }

  int col = h.hcenter();
  int row = b.seek_bottom( h.bottom(), col, false ) + 1;
  if( row >= b.vpos( 90 ) )
    { col = h.left(); row = b.seek_bottom( h.bottom(), col, false ) + 1; }
  if( row >= b.bottom() ) return 0;

  if( b.escape_right( row, col ) )
    {
    if( ( lp.ispit() && b.seek_bottom( row, h.right() ) < b.bottom() ) ||
        ( lp.isconvex() && b.seek_bottom( row, h.hcenter() ) < b.bottom() ) )
      return 'e';
    if( bp.ispit() )
      {
      int row2 = b.seek_bottom( row, h.right() );
      if( row2 < b.vpos( 75 ) ) return 'g';
      if( row2 < b.bottom() ) return 'e';
      }
    return 'p';
    }

  else if( b.escape_left( row, col ) )
    {
    Profile hlp( h, Profile::left );
    Profile htp( h, Profile::top );
    Profile hwp( h, Profile::width );
    if( vbars() == 1 && vbar(0).hcenter() > b.hcenter() &&
        hlp.decreasing() && htp.decreasing() &&
        hwp[hwp.pos(30)] < hwp[hwp.pos(70)] )
      return '4';
    if( rp.isconvex() && rp.ispit() && rp.minima() == 1 && tp.ispit() &&
        charbox.bottom() > b.vpos( 80 ) )
      return '9';
    int hdiff;
    if( b.bottom_hook( &hdiff ) && hdiff > 0 )
      {
      if( h.bottom() < b.vcenter() && h.right() + 2 <= b.right() &&
          ( !b.get_bit( h.bottom() + 1, h.right() + 1 ) ||
            !b.get_bit( h.bottom() + 1, h.right() + 2 ) || rp.isctip() ) )
        return 's';
      else return 'g';
      }
    if( row > b.vpos( 85 ) && tp.ispit() ) return 'Q';
    int row2 = b.seek_bottom( row, col );
    if( row2 < b.bottom() && rp.increasing( ( ( row + row2 ) / 2 ) - b.top() ) )
      return 'g';
    if( bp.minima() == 1 )
      {
      if( h.height() >= charbox.height() ) return 'Q';
      if( h.right() < b.hcenter() && h.bottom() < b.vcenter() ) return '2';
      return 'q';
      }
    }
  return 0;
  }


int Features::test_4ADQao( const Charset & charset, const Rectangle & charbox ) const
  {
  const Bitmap & h = b.hole( 0 );
  int left_delta = h.left() - b.left(), right_delta = b.right() - h.right();

  if( !lp.ispit() && lp.isflats() && rp.ispit() ) return 'D';
  if( !rp.isconvex() )
    {
    if( Ocrad::similar( left_delta, right_delta, 40 ) &&
        tp.minima() == 2 && bp.minima() == 2 ) return '#';
    if( tp.minima() == 1 && bp.minima() == 1 )
      {
      int row = b.seek_bottom( h.bottom(), h.hcenter(), false );
      if( charset.enabled( Charset::iso_8859_15 ) ||
          charset.enabled( Charset::iso_8859_9 ) )
        if( !lp.isconvex() && bp.isconvex() &&
            b.seek_bottom( row, h.hcenter() ) < b.bottom() )
          return UCS::SEACUTE;
      row = ( row + b.seek_bottom( row, h.hcenter() ) ) / 2;
      if( row < b.bottom() - 1 && !lp.isflats() &&
          b.seek_left( row, h.hcenter() ) <= b.left() )
        {
        if( wp[h.top()-b.top()] < wp[h.bottom()-b.top()] ) return '4';
        return 'Q';
        }
      }
    if( 2 * b.width() > 5 * h.width() )
      {
      const int c = segments_in_row( h.vcenter() );
      const int m = bp.minima();
      if( c == 3 && h.top() < b.vcenter() && h.bottom() > b.vcenter() &&
          3 * h.height() >= b.height() && ( m == 3 || m == 2 ) && !lp.ispit() )
        return 'm';
      if( c == 3 && left_delta > right_delta && lp.ispit() &&
          segments_in_col( h.hcenter() ) == 4 )
        return '@';
      if( c == 4 && Ocrad::similar( left_delta, right_delta, 40 ) && lp.ispit() )
        return '@';
      }
    if( tp.minima() == 1 && bp.istip() && !lp.isconvex() && !rp.isctip( 66 ) )
      return 'A';
    }
  if( Ocrad::similar( left_delta, right_delta, 50 ) )
    {
    if( bp.minima() == 1 && rp.isconvex() && b.test_BD() ) return 'D';
    if( bp.minima() > 1 || rp.minima() > 1 || b.test_Q() )
      { if( 4 * h.size() >= b.size() || tp.ispit() || lp.ispit() ) return 'Q';
      else return 0; }
    if( 3 * bp[bp.pos(100)] < b.height() && 5 * rp[rp.pos(55)] >= b.width() )
      return 'a';
    if( lp.istip() ) return 'n';
    if( b.vpos( 80 ) < charbox.vcenter() ) return UCS::DEG;
    return 'o';
    }
  if( left_delta > right_delta && rp.ispit() &&
      tp.minima() == 1 && bp.minima() == 1 ) return 'D';
  if( Ocrad::similar( left_delta, right_delta, 50 ) &&
      ( bp.minima() > 1 || rp.minima() > 1 ) ) return 'a';
  return 0;
  }


// Tests if the upper half of character is open to the left, to the right,
// and/or to the bottom
//
int Features::test_6abd( const Charset & charset ) const
  {
  const Bitmap & h = b.hole( 0 );

  if( 3 * h.width() < b.width() &&
      ( bp.minima( b.height() / 4 ) != 1 || tp.minima( h.vcenter() - b.top() ) != 1 ) ) return 0;

  int col = h.hcenter();
  int row = b.seek_top( h.top(), col, false ) - 1;
  if( row <= b.top() )
    {
    col = h.right(); if( b.right() - h.right() > h.width() ) ++col;
    row = b.seek_top( h.top(), col, false ) - 1;
    }
  if( row <= b.top() ) return 0;
  const int rcol = ( b.right() + h.right() ) / 2;
  const int urow = h.top() - ( b.bottom() - h.bottom() );
  const bool oacute1 = ( ( b.seek_right( urow - 1, h.right() ) >= b.right() ) ||
                         ( b.seek_right( row, col ) >= b.right() ) );

  if( b.escape_right( row, col ) )
    {
    const int noise = ( b.width() / 30 ) + 1;
    const int c = lp[urow-b.top()];
    const bool oacute2 = ( c > lp[h.top()-b.top()] + noise &&
                           urow <= b.top() + tp[std::min( c - 1, b.width() / 4 )] );
    if( ( oacute1 && oacute2 ) && ( charset.enabled( Charset::iso_8859_15 ) ||
                                    charset.enabled( Charset::iso_8859_9 ) ) )
      {
      const bool oacute3 = ( b.right() - rp[rp.pos(5)] >= h.right() ||
                             b.left() + lp[h.top()-b.top()] <= b.hpos( 5 ) );
      if( oacute3 ) return UCS::SOACUTE;
      }
    if( !oacute2 && lp.ispit() && bp.ispit() )
      {
      int row2 = b.seek_top( h.top(), h.right() + 1, false ) - 1;
      row2 = b.seek_top( row2, h.right() + 1 );
      if( row2 > b.top() ) return '6';
      }
    int row2 = b.seek_top( h.top(), rcol, false ) - 1;
    row2 = b.seek_top( row2, rcol );
    if( row2 <= b.top() ) return 'b';
    const int m = tp.minima( b.height() / 2 );
    if( m == 1 ) return 's'; else if( m == 2 ) return 'k'; else return 0;
    }

  if( b.escape_left( row, col ) )
    {
    const int col2 = std::max( h.left(), h.hpos( 10 ) );
    int row2 = b.seek_top( h.top(), col2, false ) - 1;
    row2 = b.seek_top( row2, col2 );
    if( row2 > b.top() )
      {
      if( charset.enabled( Charset::iso_8859_15 ) ||
          charset.enabled( Charset::iso_8859_9 ) )
        {
        int row3 = b.seek_top( row, col );
        if( row > b.vcenter() && row3 > b.vpos( 20 ) ) return UCS::SAACUTE;
        if( oacute1 ) return UCS::SOGRAVE;
        }
      return 'a';
      }
    if( charset.enabled( Charset::iso_8859_15 ) ||
        charset.enabled( Charset::iso_8859_9 ) )
      if( oacute1 ) return UCS::SOACUTE;
    return 'd';
    }

  if( b.width() > 3 * h.width() && h.top() < b.vcenter() &&
      segments_in_row( b.vcenter() ) == 3 && !lp.isconvex() ) return 'm';
  int hdiff; if( b.top_hook( &hdiff ) && hdiff > 0 ) return 's';
  return 0;
  }
