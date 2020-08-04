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
#include <cstdlib>

#include "common.h"
#include "rectangle.h"
#include "segment.h"
#include "ucs.h"
#include "bitmap.h"
#include "blob.h"
#include "profile.h"
#include "feats.h"


// Looks for three black sections in column hcenter() ± n, then tests if
// upper and lower gaps are open to the right or to the left
//
int Features::test_235Esz( const Charset & charset ) const
  {
  const int csize = 3;
  const int ucoff[csize] = { 0, -1, +1 };
  const int lcoff[3*csize] = { 0, -1, +1, -1, 0, +1, +1, 0, -1 };

  if( b.width() < 9 || b.height() > 3 * b.width() ||
      bp.minima( b.height() / 2 ) > 1 ) return 0;

  const int noise = ( std::min( b.height(), b.width() ) / 15 ) + 1;
  int lrow1 = 0, urow2 = 0, lrow2 = 0, urow3 = 0;
  int lcol1 = 0, ucol2 = 0, lcol2 = 0, ucol3 = 0;
  bool done = false;

  for( int i = 0; i < csize && !done; ++i )
    {
    const int ucol = b.hcenter() + ( noise * ucoff[i] );
    int row = b.top() + tp[ucol-b.left()];
    while( ++row < b.bottom() && b.get_bit( row, ucol ) ) ;
    if( row <= b.vpos( 30 ) ) { lrow1 = row; lcol1 = ucol; } else continue;
    while( ++row < b.bottom() && !b.get_bit( row, ucol ) ) ;
    if( row < b.bottom() )
      {
      urow2 = row - 1; ucol2 = ucol;
      for( int j = 0; j < csize && !done; ++j )
        {
        row = urow2 + 1;
        const int lcol = b.hcenter() + ( noise * lcoff[(csize*i)+j] );
        if( ucol != lcol )
          {
          const int d = ( ucol > lcol ) ? +1 : -1;
          int c = lcol; while( c != ucol && b.get_bit( row, c ) ) c += d;
          if( c != ucol ) continue;
          }
        while( ++row < b.bottom() && b.get_bit( row, lcol ) ) ;
        if( row < b.bottom() ) { lrow2 = row; lcol2 = lcol; } else continue;
        while( ++row <= b.bottom() && !b.get_bit( row, lcol ) ) ;
        if( row <= b.bottom() && row > b.vpos( 70 ) )
          { urow3 = row - 1; ucol3 = lcol; done = true; }
        }
      }
    }
  if( !done ) return 0;

  const bool bopen = b.escape_bottom( urow3, ucol3 );
  const bool topen = b.escape_top( lrow1, lcol1 );
  const bool tbopen = bopen && topen;
  const int ascode = ( b.get_bit( b.vcenter(), b.hcenter() ) ) ? '*' : 0;
  if( b.escape_left( lrow2, lcol2 ) )
    {
    if( b.escape_left( urow2, ucol2 ) )
      {
      if( tbopen ) return ascode;
      if( !bopen && !topen && b.height() <= 3 * b.width() )
        {
        const int lm = lp.minima(), rm = rp.minima();
        if( ( lm == 3 || lm == 2 ) &&
            ( rm == 2 || ( rm == 1 && rp.iminimum() < rp.pos( 80 ) ) ) )
          return '3';
        }
      }
    else if( b.escape_right( urow2, ucol2 ) )
      {
      if( tbopen ) return ascode;
      if( rp[lrow1 + 1 - b.top()] >= lcol1 - b.left() &&
          ( lp[lrow2 + 1 - b.top()] < lcol2 - b.left() ||
            lp[urow3 - 1 - b.top()] < ucol3 - b.left() ) )
        {
        int c = 0, hdiff;
        if( !b.top_hook( &hdiff ) || 5 * hdiff >= 4 * b.height() ) ++c;
        if( 2 * lp[lrow2 - b.top()] < lcol2 - b.left() ) ++c;
        if( !tp.isconvex() || ( !tp.ispit() && bp.ispit() ) ) ++c;
        if( c >= 2 ) return '5';
        }
      if( charset.enabled( Charset::iso_8859_15 ) ||
          charset.enabled( Charset::iso_8859_9 ) )
        if( urow2 > b.vpos( 55 ) &&
            b.seek_right( urow2 - 1, ucol2 ) < b.right() )
          { if( urow2 > b.vpos( 63 ) ) return UCS::CCCEDI;
          else return UCS::SCCEDI; }
      return 's';
      }
    }
  else if( b.escape_right( lrow2, lcol2 ) )
    {
    if( b.escape_right( urow2, ucol2 ) )
      {
      if( tbopen ) return ascode;
      if( bp.minima( b.height() / 5 ) == 1 )
        {
        if( 8 * lp[((lrow2+urow3)/2)-b.top()] >= b.width() &&
            b.escape_top( ( lrow1 + urow2 ) / 2, b.left() ) &&
            !b.escape_top( ( lrow2 + urow3 ) / 2, b.left() ) ) return 'f';
        if( rp.minima( b.width() / 8 ) < 3 && b.escape_bottom( urow3, ucol3 ) )
          {
          if( charset.enabled( Charset::iso_8859_15 ) ||
              charset.enabled( Charset::iso_8859_9 ) )
            if( 2 * lp[lp.pos(95)] > rp[rp.pos(95)] )
              { if( urow2 > b.vpos( 63 ) ) return UCS::CCCEDI;
              else return UCS::SCCEDI; }
          return 'F';
          }
        else if( lrow1 < urow2 && lrow2 < urow3 ) return 'E';
        }
      }
    else if( b.escape_left( urow2, ucol2 ) )
      {
      if( !tbopen && ( 2 * lp[lp.pos(50)] ) + 2 >= b.width() &&
          ( tp.isconvex() || ( tp.ispit() && !bp.ispit() ) ) )
        return '2';
      if( b.height() <= 2 * wp.max() && bp[bp.pos(75)] <= b.height() / 10 )
        return 'z';
      }
    }
  return 0;
  }


int Features::test_CEFIJLlT( const Charset & charset ) const
  {
  if( tp.minima( b.height() / 4 ) != 1 || bp.minima( b.height() / 4 ) != 1 )
    return 0;

  const int noise = ( std::min( b.height(), b.width() ) / 30 ) + 1;
  {
  int col;
  if( 2 * ( lp[lp.pos(50)] + noise ) >= b.width() ) col = b.hpos( 25 );
  else col = b.hpos( 75 );
  int row = b.seek_top( b.vcenter(), col );
  if( row <= b.top() || ( row < b.vpos( 25 ) && b.escape_top( row, col ) ) )
    {
    int hdiff;
    if( b.bottom_hook( &hdiff ) )
      {
      if( hdiff > b.height() / 2 && rp.increasing( rp.pos( 80 ), 1 ) &&
          !rp.decreasing() ) return 'J';
      if( -hdiff > b.height() / 2 )
        {
        if( 5 * lp[lp.pos(80)] >= 2 * b.width() ) return 'v';
        if( col > b.hcenter() ) return 'L';
        }
      }
    }
  }

  const int vnoise = ( b.height() / 30 ) + 1;
  const int topmax = b.top() + vnoise;
  const int botmin = b.bottom() - vnoise;
  if( vbars() == 1 && vbar(0).width() >= 2 && 2 * vbar(0).width() < b.width() )
    {
    if( std::abs( vbar(0).hcenter() - b.hcenter() ) <= noise &&
        std::abs( (vbar(0).left() - b.left()) - (b.right() - vbar(0).right()) ) <= 2 * noise )
      {
      if( hbars() == 1 && 4 * hbar(0).height() <= b.height() )
        {
        if( hbar(0).top() <= topmax || hbar(0).bottom() < b.vpos( 15 ) )
          return 'T';
        if( std::abs( hbar(0).vcenter() - b.vcenter() ) <= 1 &&
            Ocrad::similar( b.height(), b.width(), 50 ) ) return '+';
        }
      if( hbars() == 2 &&
          hbar(0).top() <= topmax && 4 * hbar(0).height() <= b.height() &&
          hbar(1).bottom() >= botmin && 4 * hbar(1).height() <= b.height() &&
          3 * hbar(0).width() > 4 * hbar(1).width() )
        return 'T';
      }
    }

  if( vbars() == 1 && vbar(0).width() >= 2 &&
      2 * vbar(0).width() <= b.width() )
    {
    if( vbar(0).right() <= b.hcenter() )
      {
      if( ( hbars() == 2 || hbars() == 3 ) && hbar(0).top() <= topmax &&
          hbar(0).width() + 1 >= hbar(1).width() &&
          2 * hbar(1).width() >= 3 * vbar(0).width() &&
          vbar(0).h_overlaps( hbar(1) ) )
        {
        if( hbars() == 3 &&
            Ocrad::similar( hbar(0).width(), hbar(2).width(), 10, 2 ) &&
            10 * hbar(2).width() >= 9 * hbar(1).width() &&
            hbar(0).left() <= hbar(1).left() + 1 )
          return 'E';
        if( ( hbars() == 2 || hbar(0).width() > hbar(2).width() ) &&
            ( hbar(1).includes_vcenter( b ) ||
              ( 3 * hbar(1).width() > 2 * hbar(0).width() &&
                10 * lp[vnoise] < b.width() && hbar(1).top() > b.vpos( 30 ) &&
                hbar(1).bottom() < b.vpos( 60 ) ) ) )
          return 'F';
        }
      if( hbars() == 2 && hbar(1).bottom() >= botmin &&
          b.height() > b.width() && hbar(1).width() > hbar(0).width() &&
          std::abs( vbar(0).hcenter() - hbar(0).hcenter() ) <= 1 &&
          rp.iminimum() > rp.pos( 70 ) )
        return 'L';
      if( hbars() == 1 && Ocrad::similar( hbar(0).width(), b.width(), 10 ) &&
          vbar(0).left() <= b.hpos( 30 ) )
        {
        if( hbar(0).bottom() >= botmin &&
            b.escape_top( b.vcenter(), b.hpos( 75 ) ) )
          return 'L';
        if( hbar(0).top() <= topmax && 2 * wp[wp.pos(50)] >= b.width() &&
            4 * wp[wp.pos(75)] < b.width() &&
            b.escape_right( b.vpos( 25 ), b.hcenter() ) )
          return 'F';
        }
      }

    if( vbar(0).left() > b.hcenter() &&
        hbars() == 1 && hbar(0).top() <= topmax &&
        hbar(0).width() + 1 >= b.width() )
      {
      if( charset.enabled( Charset::iso_8859_15 ) ||
          charset.enabled( Charset::iso_8859_9 ) )
        if( b.width() > b.height() ) return UCS::NOT;
      return 0;
      }
    }

  if( vbars() == 1 && vbar(0).width() >= 2 &&
      tp.minima() == 1 && bp.minima() == 1 )
    {
    if( 3 * b.height() > 4 * b.width() &&
        Ocrad::similar( vbar(0).left() - b.left(),
                        b.right() - vbar(0).right(), 30, 2 * noise ) )
      {
      if( b.height() <= 3 * wp.max() && rp.istip() && lp.istip() )
        {
        if( b.height() <= 3 * b.width() &&
            lp[lp.pos(40)] > lp[lp.pos(60)] + noise &&
            rp[rp.pos(60)] > rp[rp.pos(40)] + noise ) return 'z';
        return 'I';
        }
      if( rp.isflats() &&
          ( lp.istip() || lp.isflats() ||
            ( lp.isctip() && lp.minima() == 2 &&
              lp.iminimum() < lp.pos( 30 ) && lp.iminimum(1) > lp.pos( 80 ) ) ) )
        return 'l';
      if( b.height() > 3 * wp.max() )
        {
        if( rp.istip() && lp.ispit() && Ocrad::similar( lp.iminimum(), lp.pos( 50 ), 10 ) )
          { if( lp.istpit() ) return '{'; else return '('; }
        if( lp.istip() && rp.ispit() && Ocrad::similar( rp.iminimum(), rp.pos( 50 ), 10 ) )
          { if( rp.istpit() ) return '}'; else return ')'; }
        if( rp.isflats() && 2 * vbar(0).size() >= b.area() ) return 'l';
        }
      if( 2 * b.height() > 3 * b.width() && lp.minima() <= 2 )
        if( rp.isflats() || rp.minima() == 1 )
          if( vbar(0).right() >= b.hpos( 70 ) ||
              b.escape_top( b.vpos( 75 ), std::min( b.right(), vbar(0).right() + 1 ) ) )
            for( int i = vbar(0).left() - 1; i > b.left(); --i )
              if( b.seek_bottom( b.vpos( 75 ), i ) < b.bottom() &&
                  bp[i-b.left()] <= noise ) return 'l';
      }
    if( vbar(0).left() <= b.left() + 1 && b.height() > 2 * b.width() &&
        rp.istip() )
      {
      if( 2 * rp[rp.pos(50)] > b.width() )
        {
        int row = b.seek_top( b.vcenter(), b.hcenter() );
        int col = b.seek_right( row, b.hcenter() );
        if( col < b.right() )
          {
          row = b.seek_bottom( b.vcenter(), b.hcenter() );
          col = b.seek_right( row, b.hcenter() );
          if( col < b.right() ) return 'C';
          }
        }
      return '[';
      }
    if( vbar(0).right() >= b.right() - 1 )
      {
      if( lp.istip() && b.height() > 2 * b.width() )
        {
        if( 2 * vbar(0).width() <= wp.max() &&
            lp[lp.pos(50)] >= b.width() / 2 ) return ']';
        if( b.height() >= 3 * b.width() ) return 'l';
        }
      if( 2 * b.height() >= 3 * b.width() &&
          vbar(0).height() >= 3 * vbar(0).width() &&
          lp.istpit() && lp.minima() == 1 )
        { const int i = lp.iminimum();
          if( i > lp.pos( 10 ) && i < lp.pos( 40 ) ) return '1'; }
      }
    }
  if( hbars() == 1 && std::abs( hbar(0).vcenter() - b.vcenter() ) <= 1 &&
      Ocrad::similar( b.height(), b.width(), 50 ) &&
      tp.isupit() && bp.isupit() )
    return '+';
  return 0;
  }


int Features::test_c() const
  {
  if( lp.isconvex() || lp.ispit() )
    {
    int urow = b.seek_top( b.vcenter(), b.hcenter() );
    int lrow = b.seek_bottom( b.vcenter(), b.hcenter() );

    if( b.height() > 2 * b.width() &&
        ( 3 * wp.max() <= 2 * b.width() ||
        ( 2 * rp[urow-b.top()] >= b.width() && 2 * rp[lrow-b.top()] >= b.width() ) ) )
      { if( lp.isconvex() ) return '('; else return 0; }

    if( urow > b.top() && lrow < b.bottom() && rp.isctip() &&
        ( bp.ispit() || tp.ispit() || ( bp.islpit() && tp.islpit() ) ) &&
        b.escape_right( b.vcenter(), b.hcenter() ) )
      return 'c';
    }

  if( b.height() > 2 * b.width() && rp.isconvex() )
    {
    int urow = b.seek_top( b.vcenter(), b.hcenter() );
    int lrow = b.seek_bottom( b.vcenter(), b.hcenter() );

    if( 3 * wp.max() <= 2 * b.width() ||
        ( 2 * lp[urow-b.top()] >= b.width() && 2 * lp[lrow-b.top()] >= b.width() ) )
      return ')';
    }

  return 0;
  }


int Features::test_frst( const Rectangle & charbox ) const
  {
  if( bp.minima( b.height() / 4 ) != 1 || tp.minima( b.height() / 2 ) != 1 ||
      bp.minima( b.height() / 2 ) != 1 ) return 0;
  const int noise = ( std::min( b.height(), b.width() ) / 30 ) + 1;
  const bool maybe_slanted_r = ( tp.minima( b.height() / 4 ) != 1 );
  bool maybe_t = true;

  if( !maybe_slanted_r )
    {
    int b_hdiff = 0, t_hdiff = 0;
    if( b.bottom_hook( &b_hdiff ) )
      {
      if( -2 * b_hdiff > b.height() )
        {
        if( b.height() >= 3 * wp.max() &&
            ( hbars() == 0 || hbar(0).bottom() < b.vpos( 20 ) ) ) return 'l';
        if( 2 * wp[wp.pos(6)] < b.width() && hbars() >= 1 && hbars() <= 2 &&
            hbar(0).top() >= b.vpos( 15 ) && hbar(0).bottom() < b.vcenter() &&
            Ocrad::similar( hbar(0).width(), wp.max(), 10 ) ) return 't';
        }
      }
    if( b.top_hook( &t_hdiff ) )
      {
      if( 3 * t_hdiff > 2 * b.height() && b.height() > 2 * wp.max() &&
          tp.iminimum() > tp.pos( 50 ) && bp.iminimum() <= bp.pos( 50 ) &&
          ( !b_hdiff || rp.increasing( rp.pos( 50 ) ) ) )
        return 'f';
      if( 2 * b_hdiff > b.height() && 2 * t_hdiff > b.height() )
        return 0;	// recognized 's' or SCCEDI
      maybe_t = false;
      }
    }

  if( 2 * rp[rp.pos(50)] > b.width() &&
      2 * bp[bp.pos(50)] > b.height() && tp.isctip() ) return 'r';

  if( maybe_slanted_r || vbars() != 1 || vbar(0).width() < 2 ) return 0;
  if( vbar(0).hcenter() <= b.hcenter() )
    {
    const int col = b.right() - rp[rp.pos(50)] + 2;
    if( col < b.right() )
      {
      const int row = b.seek_bottom( b.vcenter(), col );
      if( row >= b.bottom() || b.escape_bottom( row - 1, col ) )
        {
        if( rp.minima() == 3 )
          { if( rp.minima( b.width() / 8 ) < 3 ) return 'f'; else return 0; }
        if( Ocrad::similar( b.height(), b.width(), 40 ) )
          {
          if( tp.minima( b.height() / 8 ) == 2 &&
              bp.minima( b.height() / 8 ) == 2 ) return 'x';
          int row2 = b.vpos( 75 );
          int col2 = b.seek_right( row2, b.hcenter(), false ) + 1;
          if( b.seek_right( row2, col2 ) >= b.right() )
            {
            if( lp.isconvex() && ( col > b.hpos( 60 ) || row < b.bottom() ) )
              return 0;
            if( ( hbars() == 1 ||
                  ( hbars() == 2 && hbar(1).bottom() >= b.bottom() - 1 &&
                  2 * hbar(0).width() > 3 * hbar(1).width() ) ) &&
                hbar(0).top() <= b.top() + 1 &&
                4 * hbar(0).height() <= b.height() &&
                4 * lp[lp.pos(50)] >= b.width() )
              return 'T';
            return 'r';
            }
          }
        }
      if( Ocrad::similar( b.height(), b.width(), 40 ) &&
          segments_in_row( b.vpos( 15 ) ) == 3 &&
          segments_in_row( b.vpos( 85 ) ) == 3 &&
          b.seek_right( row - 1, col ) < b.right() && lp.isctip() )
        return 'x';
      }
    if( 3 * b.height() > 4 * b.width() && vbar(0).left() > b.left() &&
        rp.minima() <= 2 )
      {
      const int col = b.right() - std::max( 0, rp[rp.pos(50)] - 1 );
      if( !b.escape_bottom( b.vcenter(), col ) )
        {
        if( 3 * wp[wp.pos(6)] < 2 * b.width() && tp.ispit() &&
            lp.iminimum() < lp.pos( 40 ) ) return 't';
        else return 0;
        }
      else if( 2 * wp.max() > b.width() )
        {
        if( rp.iminimum() < rp.pos( 20 ) )
          {
          if( rp.increasing( rp.pos( 20 ) ) || bp.increasing() ||
              tp.minima( noise ) == 2 ||
              ( rp.minima() == 1 && ( b.height() < charbox.height() || tp.iminimum() > tp.pos( 50 ) ) ) )
            { if( b.height() <= 3 * wp.max() ) return 'r'; else return 0; }
          else if( 3 * b.height() >= 5 * b.width() ) return 'f';
          }
        else
          {
          if( maybe_t && !rp.isconvex() && bp.minima( b.height() / 3 ) == 1 )
            return 't';
          else return 0;
          }
        }
      }
    if( b.seek_bottom( b.vcenter(), b.hpos( 60 ) + 1 ) >= b.bottom() )
      { if( rp.minima() == 2 ) return 'f'; else return 'r'; }
    if( vbar(0).right() <= b.hcenter() && hbars() == 1 &&
        hbar(0).bottom() >= b.bottom() - 1 && lp.istip() && rp.istip() &&
        !b.escape_top( b.vcenter(), b.hpos( 75 ) ) )
      return 'r';
    }
  return 0;
  }


int Features::test_G() const
  {
  if( lp.isconvex() || lp.ispit() )
    {
    int col = 0, row = 0;
    for( int i = rp.pos( 30 ); i <= rp.pos( 60 ); ++i )
      if( rp[i] > col ) { col = rp[i]; row = i; }
    if( col == 0 ) return 0;
    row += b.top(); col = b.right() - col + 1;
    if( col <= b.left() || col >= b.hcenter() ) return 0;

    col = ( col + b.hcenter() ) / 2;
    row = b.seek_bottom( row, col );
    if( row < b.bottom() && b.escape_right( row, col ) &&
        !b.escape_bottom( row, b.hcenter() ) )
      {
      const int noise = std::max( 2, b.height() / 20 );
      int lrow, urow;
      for( lrow = row - 1 ; lrow > b.top(); --lrow )
        if( b.seek_right( lrow, b.hcenter() ) >= b.right() ) break;
      for( urow = lrow - 1 ; urow > b.top(); --urow )
        if( b.seek_right( urow, b.hcenter() ) < b.right() ) break;
      lrow += noise; urow -= noise;
      if( lrow < row && urow > b.top() )
        {
        int uwidth = b.seek_left( urow, b.right() ) - b.seek_right( urow, b.hcenter() );
        int lwidth = b.seek_left( lrow, b.right() ) - b.seek_right( lrow, b.hcenter() );
        if( lrow - noise <= b.vcenter() || lwidth > uwidth + noise )
          return 'G';
        }
      }
    }
  return 0;
  }


// Common feature: U-shaped top of character
//
int Features::test_HKMNUuvwYy( const Rectangle & charbox ) const
  {
  if( tp.minima( b.height() / 5 ) == 2 && tp.minima( b.height() / 4 ) == 2 &&
      tp.minima( b.height() / 2 ) <= 3 && tp.isctip() )
    {
    const int noise = ( std::min( b.height(), b.width() ) / 30 ) + 1;
    const int m5 = bp.minima( b.height() / 5 );
    if( 2 * b.height() >= b.width() && b.height() >= 10 &&
        ( m5 == 1 ||
          ( m5 == 2 && Ocrad::similar( bp.iminimum(), bp.pos( 50 ), 10 ) ) ) )
      {
      const int lg = lp.min( lp.pos( 90 ) );
      if( lg > 1 && bp.isvpit() && tp.minima( b.height() / 2 ) == 2 &&
          lp[lp.pos(75)] <= lg ) return 'v';
      int hdiff;
      if( b.bottom_hook( &hdiff ) )
        {
        if( std::abs( hdiff ) <= b.height() / 8 )
          {
          if( segments_in_row( b.vpos( 30 ) ) >= 3 ) return 'v';
          if( bp.isconvex() )
            { if( 9 * wp[wp.pos(30)] > 10 * wp[wp.pos(50)] &&
                  9 * wp[wp.pos(50)] > 10 * wp[wp.pos(70)] ) return 'v';
            else return 'u'; }
          }
        if( hdiff > b.height() / 2 )
          { if( bp.minima( b.height() / 2 ) == 1 ) return 'y'; else return 0; }
        }
      const int rg = rp.min( rp.pos( 90 ) );
      const int lg2 = lp.max( lp.pos( 70 ), lp.pos( 90 ) );
      const int rg2 = rp.max( rp.pos( 70 ), rp.pos( 90 ) );
      const int lc = ( lg + ( 2 * ( lp.limit() - rg ) ) ) / 3;
      const int lc2 = ( lg2 + lp.limit() - rg2 ) / 2;
      if( bp.ispit() && 7 * tp.range() < 4 * b.height() )
        {
        int row2 = b.top();
        while( row2 < b.bottom() && segments_in_row( row2 ) != 2 ) ++row2;
        int row1 = row2 + 1;
        while( row1 < b.bottom() && segments_in_row( row1 ) != 1 ) ++row1;
        if( row1 < b.bottom() ) row1 += wp[row1-b.top()] / 4;
        if( row1 < b.bottom() && wp[row1-b.top()] < b.width() )
          {
          const int w1 = wp[row1-b.top()];
          int row0 = w1 * ( row1 - row2 ) / ( b.width() - w1 ) + row1;
          if( row0 < b.bottom() && 2 * wp[wp.pos(70)] < b.width() &&
              ( Ocrad::similar( lg, rg, 20 ) ||
              ( lg > 1 && lg < rg && lc >= lc2 && !rp.increasing() ) ) )
            return 'Y';
          }
        }
      if( b.escape_top( b.vpos( 60 ), b.hcenter() ) && !lp.istip() )
        return 'u';
      if( lg < rg + 1 && !lp.increasing( lp.pos( 50 ) ) &&
          ( 2 * lg < rg || b.vpos( 90 ) >= charbox.bottom() ) &&
          ( tp.minima( b.height()/2 ) == 1 || lp.imaximum() > b.height()/2 ) )
        return 'y';
      if( lg > 1 && bp.ispit() && tp.minima( b.height() / 3 ) == 2 )
        return 'v';
      if( lg <= 1 && 2 * ( b.width() - rg - lg ) < b.width() &&
          rp.increasing() && tp.minima( b.height() / 2 ) == 2 ) return 'v';
      return 0;
      }
    if( 2 * b.height() >= b.width() && b.height() >= 9 &&
        bp.minima() == 2 && bp.isctip() )
      {
      const int th = std::max( b.height() / 4, bp[bp.pos(50)] + noise );
      if( bp.minima( th ) == 3 ) return 'M';
      const int lg = lp[lp.pos(50)];
      const int rg = rp[rp.pos(50)];
      if( Ocrad::similar( lg, rg, 80, 2 ) &&
          4 * lg < b.width() && 4 * rg < b.width() )
        {
        if( lg > 1 && rg > 1 && lp.increasing() && rp.increasing() &&
            5 * tp[tp.pos(50)] > b.height() )
          return 'w';
        if( hbars() == 1 && 5 * ( hbar(0).height() - 1 ) < b.height() &&
            hbar(0).top() >= b.vpos( 30 ) && hbar(0).bottom() <= b.vpos( 60 ) &&
            10 * hbar(0).width() > 9 * wp[hbar(0).vcenter()-b.top()] &&
            Ocrad::similar( col_segment( hbar(0).vcenter(), hbar(0).hcenter() ).size(),
                            hbar(0).height(), 30, 2 ) )
          {
          if( 9 * hbar(0).width() < 10 * wp[wp.pos(50)] ) return 'H';
          return 0;
          }
        if( segments_in_row( b.vpos( 60 ) ) == 4 ||
            segments_in_row( b.vpos( 70 ) ) == 4 )
          {
          if( 2 * tp[tp.pos(50)] > b.height() ) return 'M';
          return 'w';
          }
        if( ( vbars() <= 2 || ( vbars() == 3 && b.height() >= b.width() ) ) &&
            tp.minima( b.height() / 2 ) <= 2 &&
            tp.minima( ( 2 * b.height() ) / 5 ) <= 2 && !lp.istpit() &&
            4 * std::abs( rp[rp.pos(20)] - rp[rp.pos(80)] ) <= b.width() )
          {
          const int row = b.top() + tp[tp.pos(50)];
          if( row > b.vcenter() )
            {
            Rectangle r( b.left(), b.top(), b.hcenter(), b.bottom() );
            Bitmap bm( b, r );
            int hdiff;
            if( bm.bottom_hook( &hdiff ) && -2 * hdiff > bm.height() ) return 'u';
            }
          if( row > b.vpos( 10 ) || vbars() >= 2 ) return 'N';
          }
        return 0;
        }
      if( 3 * lg < 2 * rg && lg < b.width() / 4 && rg > b.width() / 4 &&
          rp.isctip() && tp.minima( b.height() / 8 ) == 2 ) return 'K';
      return 0;
      }
    if( bp.minima() <= 2 && 2 * b.width() > 5 * b.height() ) return '~';
    if( bp.minima() == 3 &&
        ( hbars() == 0 || ( hbars() == 1 && hbar(0).top() >= b.vpos( 20 ) ) ) )
      return 'M';
    }
  return 0;
  }


// Looks for the nearest frontier in column hcenter(), then tests if
// gap is open downwards (except for 'x')
//
int Features::test_hknwx( const Rectangle & charbox ) const
  {
  const int m8 = tp.minima( b.height() / 8 );

  if( m8 == 2 && bp.minima( b.height() / 2 ) == 1 &&
      ( ( lp.istip() && rp.istip() ) ||
        ( lp.isconcave() && rp.isconcave() ) ) ) return 'x';

  if( b.width() >= b.height() && tp.ispit() &&
      ( b.bottom() < charbox.vcenter() || ( lp.decreasing() && rp.decreasing() ) ) )
    return '^';

  int col = 0, row = 0;
  for( int i = bp.pos( 40 ); i <= bp.pos( 60 ); ++i )
    if( bp[i] > row ) { row = bp[i]; col = i; }
  row = b.bottom() - row + 1; col += b.left();
  if( row > b.vpos( 90 ) || row <= b.top() ) return 0;
  // FIXME follow gap up
  { int c = col; col = b.seek_right( row, col ); if( col > c ) --col;
  row = b.seek_top( row, col ); }

  const int urow = b.seek_top( row - 1, col, false );
  if( urow > b.vpos( 20 ) || 3 * tp[tp.pos(60)] > b.height() )
    {
    const int m5 = tp.minima( b.height() / 5 );
    if( ( m5 == 2 || m5 == 3 ) && tp.minima() >= 2 &&
        rp[rp.pos(25)] <= b.width() / 4 &&
        ( !lp.istpit() || rp.minima() == 1 ) ) return 'w';
    if( m5 == 1 && m8 == 1 && 4 * tp.max( tp.pos(40), tp.pos(60) ) < 3 * b.height() )
      { if( rp.isctip( 66 ) ) return 'k'; else return 'h'; }
    return 0;
    }
  if( Ocrad::similar( b.height(), b.width(), 40 ) && row > b.vcenter() &&
      urow < b.vcenter() && tp.minima( b.height() / 5 ) == 2 &&
      bp.minima( urow + 1 ) == 3 )
    return 'w';
  if( urow <= b.vpos( 20 ) && tp.minima( b.height() / 4 ) == 1 &&
      Ocrad::similar( b.height(), b.width(), 40 ) &&
      ( 8 * ( rp[rp.pos(50)] - 1 ) <= b.width() ||
        tp[tp.pos(100)] > b.height() / 2 ) )
    return 'n';
  return 0;
  }


// Looks for four black sections in column hcenter() ± 1, then tests if
// upper gap is open to the right and lower gaps are open to the left
//
int Features::test_s_cedilla() const
  {
  int urow2 = 0, urow3 = 0, urow4 = 0, col, black_section = 0;

  for( col = b.hcenter() - 1; col <= b.hcenter() + 1; ++col )
    {
    bool prev_black = false;
    for( int row = b.top(); row <= b.bottom(); ++row )
      {
      bool black = b.get_bit( row, col );
      if( black && !prev_black )
        {
        if( ++black_section == 2 ) urow2 = row - 1;
        else if( black_section == 3 ) urow3 = row - 1;
        else if( black_section == 4 ) urow4 = row - 1;
        }
      prev_black = black;
      }
    if( black_section == 4 && urow2 < b.vpos( 50 ) && urow4 >= b.vpos( 70 ) )
      break;
    black_section = 0;
    }

  if( black_section == 4 && b.escape_right( urow2, col ) &&
      b.escape_left( urow3, col ) && b.escape_left( urow4, col ) )
    return UCS::SSCEDI;
  return 0;
  }


bool Features::test_comma() const
  {
  if( b.holes() || b.height() <= b.width() || b.height() > 3 * b.width() )
    return false;

  if( b.width() >= 3 && b.height() >= 3 )
    {
    int upper_area = 0;
    for( int row = b.top(); row < b.top() + b.width(); ++row )
      for( int col = b.left(); col <= b.right(); ++col )
        if( b.get_bit( row, col ) ) ++upper_area;
    if( upper_area < (b.width() - 2) * (b.width() - 2) ) return false;
    int count1 = 0, count2 = 0;
    for( int col = b.left(); col <= b.right(); ++col )
      { if( b.get_bit( b.top() + 1, col ) ) ++count1;
      if( b.get_bit( b.bottom() - 1, col ) ) ++count2; }
    if( count1 <= count2 ) return false;
    }
  return true;
  }


int Features::test_easy( const Rectangle & charbox ) const
  {
  int code = test_solid( charbox );
  if( code ) return code;

  if( b.top() >= charbox.vcenter() && test_comma() ) return ',';
  if( b.bottom() <= charbox.vcenter() &&
      b.height() > b.width() && bp.minima() == 1 )
    {
    if( tp.iminimum() < tp.pos( 50 ) && bp.iminimum() > bp.pos( 50 ) )
      return '`'; else return '\'';
    }
  if( 2 * b.height() > 3 * wp.max() && b.top() >= charbox.vcenter() &&
      bp.minima() == 1 ) return ',';
  return 0;
  }


// Recognizes single line, non-rectangular characters without holes.
// '/<>\^`
//
int Features::test_line( const Rectangle & charbox ) const
  {
  int slope1, slope2;

  if( tp.minima() != 1 ) return 0;
  if( lp.minima() == 1 && rp.minima() == 1 && 2 * b.height() >= b.width() &&
      lp.straight( &slope1 ) && rp.straight( &slope2 ) )
    {
    if( slope1 < 0 && slope2 < 0 && bp.minima() == 2 ) return '^';
    if( bp.minima() != 1 ) return 0;
    if( slope1 < 0 && slope2 > 0 )
      {
      if( b.v_includes( charbox.vcenter() ) )
        {
        if( 10 * b.area() < 3 * b.size() ) return '/';
        if( b.height() > 2 * b.width() ) return 'l';
        return 0;
        }
      if( b.top() >= charbox.vcenter() ) return ',';
      return '\'';
      }
    if( slope1 > 0 && slope2 < 0 )
      {
      if( b.bottom() > charbox.vcenter() )
        {
        if( ( 3 * b.width() > b.height() && b.height() > charbox.height() ) ||
            2 * b.width() >= b.height() ) return '\\';
        else return 0;
        }
      return '`';
      }
    return 0;
    }

  if( bp.minima() == 1 && 2 * b.width() >= b.height() &&
      tp.straight( &slope1 ) && bp.straight( &slope2 ) )
    {
    if( lp.minima() == 1 && rp.minima() == 1 )
      {
      if( slope1 < 0 && slope2 > 0 )
        {
        if( b.v_includes( charbox.vcenter() ) ) return '/';
        if( b.top() >= charbox.vcenter() ) return ',';
        return '\'';
        }
      if( slope1 > 0 && slope2 < 0 )
        {
        if( b.bottom() > charbox.vcenter() ) return '\\';
        return '`';
        }
      }
    else if( 2 * b.width() >= b.height() )
      {
      if( slope1 < 0 && slope2 < 0 && lp.minima() == 1 && rp.minima() == 2 )
        return '<';
      if( slope1 > 0 && slope2 > 0 && lp.minima() == 2 && rp.minima() == 1 )
        return '>';
      }
    }
  return 0;
  }


int Features::test_solid( const Rectangle & charbox ) const
  {
  if( b.holes() ) return 0;

  if( b.height() >= 5 && b.width() >= 5 )
    {
    if( 2 * b.height() > b.width() && ( tp.minima() != 1 || bp.minima() != 1 ) )
      return 0;
    if( b.height() < 2 * b.width() && ( lp.minima() != 1 || rp.minima() != 1 ) )
      return 0;
    }

  int inner_area, inner_size, porosity = 0;

  if( b.width() >= 3 && b.height() >= 3 )
    {
    inner_size = ( b.width() - 2 ) * ( b.height() - 2 );
    inner_area = 0;
    for( int row = b.top() + 1; row < b.bottom(); ++row )
      {
      int holes = 0;	// FIXME
      for( int col = b.left() + 1; col < b.right(); ++col )
        { if( b.get_bit( row, col ) ) ++inner_area; else ++holes; }
      if( 5 * holes >= b.width() ) porosity += ( 5 * holes ) / b.width();
      }
    if( inner_area * 100 < inner_size * 70 ) return 0;
    }
  else { inner_size = 0; inner_area = b.area(); }

  if( Ocrad::similar( b.height(), wp.max(), 20, 2 ) )
    {
    const int n = std::min( b.height(), b.width() );
    if( n >= 6 )
      {
      int d = 0;
      for( int i = 0; i < n; ++i )
        {
        if( b.get_bit( b.top() + i, b.left() + i ) ) ++d;
        if( b.get_bit( b.top() + i, b.right() - i ) ) --d;
        }
      if( 2 * std::abs( d ) >= n - 1 ) return 0;
      }
    if( ( !porosity && inner_area * 100 >= inner_size * 75 ) ||
        ( b.width() >= 7 && b.height() >= 7 &&
          ( 100 * b.area_octagon() >= 95 * b.size_octagon() ||
            100 * b.area_octagon() >= 95 * b.area() ) ) ) return '.';
    return 0;
    }
  if( porosity > 1 || inner_area * 100 < inner_size * 85 ||
      ( porosity && inner_area * 100 < inner_size * 95 ) ) return 0;
  if( b.width() > b.height() )
    {
    if( b.top() > charbox.vpos( 90 ) ||
        ( charbox.bottom() - b.bottom() < b.top() - charbox.vcenter() &&
          b.width() >= 5 * b.height() ) ) return '_';
    return '-';
    }

  if( b.height() > b.width() )
    {
    if( b.top() > charbox.vcenter() ) return ',';
    if( b.bottom() <= charbox.vcenter() ) return '\'';
    return '|';
    }
  return 0;
  }
