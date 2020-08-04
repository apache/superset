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
#include "bitmap.h"
#include "blob.h"
#include "profile.h"


Profile::Profile( const Bitmap & bm_, const Type t )
  : bm( bm_ ), type( t ),
    limit_( -1 ), max_( -1 ), min_( -1 ), mean_( -1 ),
    isconcave_( -1 ), isconvex_( -1 ), isflat_( -1 ), isflats_( -1 ),
    ispit_( -1 ), istpit_( -1 ), isupit_( -1 ), isvpit_( -1 ), istip_( -1 ) {}


void Profile::initialize()
  {
  switch( type )
    {
    case left :
      data.resize( bm.height() ); limit_ = bm.width();
      for( int row = bm.top(); row <= bm.bottom(); ++row )
        {
        int j = bm.left();
        while( j <= bm.right() && !bm.get_bit( row, j ) ) ++j;
        data[row-bm.top()] = j - bm.left();
        } break;
    case top :
      data.resize( bm.width() ); limit_ = bm.height();
      for( int col = bm.left(); col <= bm.right(); ++col )
        {
        int j = bm.top();
        while( j <= bm.bottom() && !bm.get_bit( j, col ) ) ++j;
        data[col-bm.left()] = j - bm.top();
        } break;
    case right :
      data.resize( bm.height() ); limit_ = bm.width();
      for( int row = bm.top(); row <= bm.bottom(); ++row )
        {
        int j = bm.right();
        while( j >= bm.left() && !bm.get_bit( row, j ) ) --j;
        data[row-bm.top()] = bm.right() - j;
        } break;
    case bottom :
      data.resize( bm.width() ); limit_ = bm.height();
      for( int col = bm.left(); col <= bm.right(); ++col )
        {
        int j = bm.bottom();
        while( j >= bm.top() && !bm.get_bit( j, col ) ) --j;
        data[col-bm.left()] = bm.bottom() - j;
        } break;
    case height :
      data.resize( bm.width() ); limit_ = bm.height();
      for( int col = bm.left(); col <= bm.right(); ++col )
        {
        int u = bm.top(), d = bm.bottom();
        while( u <= d && !bm.get_bit( u, col ) ) ++u;
        while( u <= d && !bm.get_bit( d, col ) ) --d;
        data[col-bm.left()] = d - u + 1;
        } break;
    case width :
      data.resize( bm.height() ); limit_ = bm.width();
      for( int row = bm.top(); row <= bm.bottom(); ++row )
        {
        int l = bm.left(), r = bm.right();
        while( l <= r && !bm.get_bit( row, l ) ) ++l;
        while( l <= r && !bm.get_bit( row, r ) ) --r;
        data[row-bm.top()] = r - l + 1;
        } break;
    }
  }


int Profile::mean()
  {
  if( mean_ < 0 )
    {
    if( limit_ < 0 ) initialize();
    mean_ = 0;
    for( int i = 0; i < samples(); ++i ) mean_ += data[i];
    if( samples() > 1 ) mean_ /= samples();
    }
  return mean_;
  }


int Profile::max()
  {
  if( max_ < 0 )
    {
    if( limit_ < 0 ) initialize();
    max_ = data[0];
    for( int i = 1; i < samples(); ++i ) if( data[i] > max_ ) max_ = data[i];
    }
  return max_;
  }


int Profile::max( const int l, int r )
  {
  if( limit_ < 0 ) initialize();
  if( r < 0 ) r = samples() - 1;
  int m = 0;
  for( int i = l; i <= r; ++i ) if( data[i] > m ) m = data[i];
  return m;
  }


int Profile::min()
  {
  if( min_ < 0 )
    {
    if( limit_ < 0 ) initialize();
    min_ = data[0];
    for( int i = 1; i < samples(); ++i ) if( data[i] < min_ ) min_ = data[i];
    }
  return min_;
  }


int Profile::min( const int l, int r )
  {
  if( limit_ < 0 ) initialize();
  if( r < 0 ) r = samples() - 1;
  int m = limit_;
  for( int i = l; i <= r; ++i ) if( data[i] < m ) m = data[i];
  return m;
  }


int Profile::operator[]( int i )
  {
  if( limit_ < 0 ) initialize();
  if( i < 0 ) i = 0;
  else if( i >= samples() ) i = samples() - 1;
  return data[i];
  }


int Profile::area( const int l, int r )
  {
  if( limit_ < 0 ) initialize();
  if( r < 0 ) r = samples() - 1;
  int a = 0;
  for( int i = l; i <= r; ++i ) a += data[i];
  return a;
  }


bool Profile::increasing( int i, const int min_delta )
  {
  if( limit_ < 0 ) initialize();
  if( i < 0 || i > samples() - 2 || data[samples()-1] - data[i] < min_delta )
    return false;
  while( ++i < samples() ) if( data[i] < data[i-1] ) return false;
  return true;
  }


bool Profile::decreasing( int i )
  {
  if( limit_ < 0 ) initialize();
  const int noise = ( std::min( samples(), limit_ ) / 20 ) + 1;
  if( i < 0 || samples() - i <= 2 * noise ||
      data[i] - data[samples()-noise] < noise + 1 )
    return false;
  while( ++i < samples() - noise ) if( data[i] > data[i-1] ) return false;
  return true;
  }


bool Profile::isconcave()
  {
  if( isconcave_ < 0 )
    {
    isconcave_ = false; if( limit_ < 0 ) initialize();
    if( samples() < 5 ) return isconcave_;
    int dmax = -1, l = 0, r = 0;

    for( int i = pos( 10 ); i <= pos( 90 ); ++i )
      {
      if( data[i] > dmax ) { dmax = data[i]; l = r = i; }
      else if( data[i] == dmax ) { r = i; }
      }
    if( l > r || l < pos( 25 ) || r > pos( 75 ) ) return isconcave_;
    if( data[pos(10)] >= dmax || data[pos(90)] >= dmax ) return isconcave_;
    int imax = ( l + r ) / 2;

    for( int i = pos( 10 ); i < imax; ++i )
      if( data[i] > data[i+1] ) return isconcave_;
    for( int i = pos( 90 ); i > imax; --i )
      if( data[i] > data[i-1] ) return isconcave_;
    isconcave_ = true;
    }
  return isconcave_;
  }


bool Profile::isconvex()
  {
  if( isconvex_ < 0 )
    {
    isconvex_ = false; if( limit_ < 0 ) initialize();
    if( samples() < 9 || limit_ < 5 ) return isconvex_;
    int min = limit_, min_begin = 0, min_end = 0;
    int lmin = limit_, rmax = -limit_, l = 0, r = 0;

    for( int i = 1; i < samples(); ++i )
      {
      int d = data[i] - data[i-1];
      if( d < lmin ) { lmin = d; l = i - 1; }
      if( d >= rmax ) { rmax = d; r = i; }
      if( data[i] <= min )
        { min_end = i; if( data[i] < min ) { min = data[i]; min_begin = i; } }
      }
    if( l >= r || l >= pos( 25 ) || r <= pos( 75 ) ) return isconvex_;
    if( lmin >= 0 || rmax <= 0 || data[l] < 2 || data[r] < 2 ||
        3 * ( data[l] + data[r] ) <= std::min( limit_, samples() ) )
      return isconvex_;
    if( 3 * ( min_end - min_begin + 1 ) > 2 * samples() ) return isconvex_;
    if( 2 * l >= min_begin || 2 * r <= min_end + samples() - 1 ) return isconvex_;
    if( min_begin < pos( 10 ) || min_end > pos( 90 ) ) return isconvex_;

    const int noise = ( std::min( samples(), limit_ ) / 30 ) + 1;
    int dmax = -limit_;
    for( int i = l + 1; i <= r; ++i )
      {
      if( i >= min_begin && i <= min_end )
        { if( data[i] <= noise ) continue; else return isconvex_; }
      int d = data[i] - data[i-1];
      if( d == 0 ) continue;
      if( d > dmax ) { if( std::abs( d ) <= noise ) ++dmax; else dmax = d; }
      else if( d < dmax - noise ) return isconvex_;
      }
    if( 2 * ( min_end - min_begin + 1 ) < samples() )
      {
      int varea = ( min_begin - l + 1 ) * data[l] / 2;
      varea += ( r - min_end + 1 ) * data[r] / 2;
      if( this->area( l, min_begin - 1 ) + this->area( min_end + 1, r ) >= varea )
        return isconvex_;
      }
    isconvex_ = true;
    }
  return isconvex_;
  }


bool Profile::isflat()
  {
  if( isflat_ < 0 )
    {
    isflat_ = false; if( limit_ < 0 ) initialize();
    if( samples() < 10 ) return isflat_;
    int mn = data[samples()/2], mx = mn;

    for( int i = 1; i < samples() - 1; ++i )
      { int d = data[i]; if( d < mn ) mn = d; else if( d > mx ) mx = d; }
    isflat_ = (bool)( mx - mn <= 1 + ( samples() / 30 ) );
    }
  return isflat_;
  }


bool Profile::isflats()
  {
  if( isflats_ < 0 )
    {
    isflats_ = false; if( limit_ < 0 ) initialize();
    if( samples() < 12 ) return isflats_;
    const int s1 = std::max( pos( 15 ), 3 );
    const int s2 = std::min( pos( 85 ), samples() - 4 );
    int mn = -1, mx = 0;
    for( int i = s1 + 2; i < s2; ++i )
      if( data[i-1] == data[i] ) { mn = mx = data[i]; break; }
    if( mn < 0 ) return isflats_;

    for( int i = 1; i <= s1; ++i ) if( data[i] > mx ) mx = data[i];
    for( int i = s1 + 1; i < s2; ++i )
      { int d = data[i]; if( d < mn ) mn = d; else if( d > mx ) mx = d; }
    for( int i = s2; i < samples() - 1; ++i ) if( data[i] > mx ) mx = data[i];
    isflats_ = (bool)( mx - mn <= 1 + ( samples() / 30 ) );
    }
  return isflats_;
  }


bool Profile::ispit()
  {
  if( ispit_ < 0 )
    {
    ispit_ = false; if( limit_ < 0 ) initialize();
    if( samples() < 5 ) return ispit_;
    const int noise = ( std::min( samples(), limit_ ) / 25 ) + 1;
    for( int i = 0; i < noise; ++i )
      if( data[i] <= noise - i || data[samples()-i-1] <= noise - i )
        return ispit_;

    const int dmin = min(), dmax = limit_ / 2;
    int begin = 0, end = 0, i, ref;
    for( i = 0, ref = dmax; i < samples(); ++i )
      {
      int d = data[i];
      if( d == dmin ) { begin = i; break; }
      if( d < ref ) ref = d; else if( d > ref + noise && ref < dmax ) return ispit_;
      }
    if( begin < 2 || begin > samples() - 3 ) return ispit_;

    for( i = samples() - 1, ref = dmax; i >= begin; --i )
      {
      int d = data[i];
      if( d == dmin ) { end = i; break; }
      if( d < ref ) ref = d; else if( d > ref + noise && ref < dmax ) return ispit_;
      }
    if( end < begin || end > samples() - 3 ) return ispit_;

    for( i = begin + 1; i < end; ++i )
      if( data[i] > dmin + noise ) return ispit_;

    ispit_ = true;
    }
  return ispit_;
  }


bool Profile::iscpit( const int cpos )
  {
  if( limit_ < 0 ) initialize();
  if( samples() < 5 || cpos < 25 || cpos > 75 ) return false;
  const int mid = ( ( samples() - 1 ) * cpos ) / 100;
  const int iend = std::min( samples() / 4, std::min( mid, samples() - mid ) );
  const int th = ( ( mean() < 2 ) ? 2 : mean() );
  int imin = -1;

  for( int i = 0; i < iend; ++i )
    {
    if( data[mid+i] < th ) { imin = mid + i; break; }
    if( data[mid-i-1] < th ) { imin = mid - i - 1; break; }
    }
  if( imin < 0 ) return false;

  for( int i = imin + 1; i < samples(); ++i )
    if( data[i] > th )
      {
      for( int j = imin - 1; j >= 0; --j ) if( data[j] > th ) return true;
      break;
      }
  return false;
  }


bool Profile::islpit()
  {
  if( limit_ < 0 ) initialize();
  if( samples() < 5 ) return false;
  const int noise = samples() / 30;
  if( data[0] < noise + 2 ) return false;

  const int dmin = min();
  int begin = 0, ref = limit_;
  for( int i = 0; i < samples(); ++i )
    {
    int d = data[i];
    if( d == dmin ) { begin = i; break; }
    if( d < ref ) ref = d; else if( d > ref + 1 ) return false;
    }
  if( begin < 2 || 2 * begin >= samples() ) return false;
  return true;
  }


bool Profile::istpit()
  {
  if( istpit_ < 0 )
    {
    if( limit_ < 0 ) initialize();
    if( limit_ < 5 || samples() < 5 || !ispit() )
      { istpit_ = false; return istpit_; }

    const int noise = ( std::min( limit_, samples() ) / 30 ) + 1;
    int l = -1, r = 0;
    for( int i = 0; i < samples(); ++i )
      if( data[i] <= noise ) { r = i; if( l < 0 ) l = i; }
    istpit_ = (bool)( l > 0 && 4 * ( r - l + 1 ) < samples() );
    }
  return istpit_;
  }


bool Profile::isupit()
  {
  if( isupit_ < 0 )
    {
    isupit_ = false; if( limit_ < 0 ) initialize();
    if( samples() < 5 ) return isupit_;

    int th = ( mean() < 2 && range() > 2 ) ? 2 : mean();
    int status = 0, ucount = 0, lcount = 0, umean =0, lmean = 0;
    for( int i = 0; i < samples(); ++i )
      {
      int d = data[i];
      switch( status )
        {
        case 0: if( d < th )
                  { if( i < pos( 25 ) || i > pos( 70 ) ) return isupit_;
                  status = 1; break; }
                if( d > th ) { ++ucount; umean += d; }
          break;
        case 1: if( d > th )
                  { if( i < pos( 30 ) || i > pos( 75 ) ) return isupit_;
                  status = 2; break; }
                if( d < th ) { ++lcount; lmean += d; }
          break;
        case 2: if( d < th ) return isupit_;
                if( d > th ) { ++ucount; umean += d; }
          break;
        }
      }
    if( ucount > 1 ) umean /= ucount;
    if( lcount > 1 ) lmean /= lcount;
    isupit_ = (bool)( status == 2 && umean - lmean > range() / 2 );
    }
  return isupit_;
  }


bool Profile::isvpit()
  {
  if( isvpit_ < 0 )
    {
    if( limit_ < 0 ) initialize();
    if( limit_ < 5 || samples() < 5 || !ispit() )
      { isvpit_ = false; return isvpit_; }

    const int noise = limit_ / 20;
    const int level = ( limit_ / 10 ) + 2;
    int ll = -1, ln = -1, rl = -1, rn = -1;
    for( int i = 0; i < samples(); ++i )
      if( data[i] <= level )
        {
        rl = i; if( ll < 0 ) ll = i;
        if( data[i] <= noise ) { rn = i; if( ln < 0 ) ln = i; }
        }
    const int wl = rl - ll + 1, wn = rn - ln + 1;
    isvpit_ = (bool)( ln > 0 && 2 * wl <= samples() + 1 && wl - wn <= 2 * ( level - noise ) );
    }
  return isvpit_;
  }


bool Profile::istip()
  {
  if( istip_ < 0 )
    {
    istip_ = false; if( limit_ < 0 ) initialize();
    if( samples() < 5 ) return istip_;

    int th = ( mean() < 2 && range() > 2 ) ? 2 : mean(); if( th < 2 ) ++th;
    int lth = data[0], rth = data[samples()-1];
    int begin = 0, end = samples() - 1;
    for( int i = 1, j = std::max( 2, samples() / 10 ); i < j; ++i )
      {
      if( data[i] < lth ) { lth = data[i]; begin = i; }
      if( data[samples()-1-i] < rth )
        { rth = data[samples()-1-i]; end = samples() - 1 - i; }
      }
    if( lth >= th || rth >= th ) return istip_;
    if( 3 * lth >= 2 * range() || 3 * rth >= 2 * range() ) return istip_;
    th = std::max( lth, rth );
    int status = 0;
    for( int i = begin + 1; i < end; ++i )
      switch( status )
        {
        case 0: if( data[i] > th + 1 ) status = 1; break;
        case 1: if( data[i] > th + 1 ) status = 2; else status = 0; break;
        case 2: if( data[i] <= th ) status = 3; break;
        case 3: if( data[i] > th + 1 ) return istip_;
        }
    istip_ = (bool)( status >= 2 );
    }
  return istip_;
  }


bool Profile::isctip( const int cpos )
  {
  if( limit_ < 0 ) initialize();
  if( samples() < 5 || cpos < 25 || cpos > 75 ) return false;
  const int mid = ( ( samples() - 1 ) * cpos ) / 100;
  const int iend = std::min( samples() / 4, std::min( mid, samples() - mid ) );
  int th = std::max( 2, std::min( mean(), limit_ / 3 ) );
  int imax = -1;

  for( int i = 0; i < iend; ++i )
    {
    if( data[mid+i] > th ) { imax = mid + i; break; }
    if( data[mid-i-1] > th ) { imax = mid - i - 1; break; }
    }
  if( imax < 0 && mean() == 0 )
    {
    --th;
    for( int i = 0; i < iend; ++i )
      {
      if( data[mid+i] > th ) { imax = mid + i; break; }
      if( data[mid-i-1] > th ) { imax = mid - i - 1; break; }
      }
    }
  if( imax < 0 ) return false;

  th = std::max( th, data[imax] / 2 );
  for( int i = imax + 1; i < samples(); ++i )
    if( data[i] < th )
      {
      for( int j = imax - 1; j >= 0; --j ) if( data[j] < th ) return true;
      break;
      }
  return false;
  }


int Profile::imaximum()
  {
  if( limit_ < 0 ) initialize();
  const int margin = ( samples() / 30 ) + 1;
  int mbegin = 0, mend, mvalue = 0;

  for( int i = margin; i < samples() - margin; ++i )
    if( data[i] > mvalue ) { mvalue = data[i]; mbegin = i; }

  for( mend = mbegin + 1; mend < samples(); ++mend )
    if( data[mend] < mvalue ) break;

  return ( mbegin + mend - 1 ) / 2;
  }


int Profile::iminimum( const int m, int th )
  {
  if( limit_ < 0 ) initialize();
  const int margin = ( samples() / 30 ) + 1;
  if( samples() < 2 * margin ) return 0;
  if( th < 2 ) th = ( mean() < 2 ) ? 2 : mean();
  int minima = 0, status = 0;
  int begin = 0, end, value = limit_ + 1;

  for( end = margin; end < samples() - margin; ++end )
    {
    if( status == 0 )
      { if( data[end] < th ) { status = 1; ++minima; begin = end; } }
    else if( data[end] > th )
      { if( minima == m + 1 ) { --end; break; } else status = 0; }
    }
  if( end >= samples() ) --end;
  if( minima != m + 1 ) return 0;

  for( int i = begin; i <= end; ++i )
    if( data[i] < value ) { value = data[i]; begin = i; }
  for( ; end >= begin; --end ) if( data[end] == value ) break;
  return ( begin + end ) / 2;
  }


int Profile::minima( int th )
  {
  if( limit_ < 0 ) initialize();
  if( !samples() ) return 0;
  if( th < 1 ) th = ( mean() < 2 ) ? 2 : mean();
  const int noise = limit_ / 40;
  const int dth = th - ( ( noise + 1 ) / 2 ), uth = th + ( noise / 2 );
  if( dth < 1 ) return 1;
  int minima = ( data[0] < dth ) ? 1 : 0;
  int status = ( minima ) ? 1 : 0;

  for( int i = 1; i < samples(); ++i )
    switch( status )
      {
      case 0: if( data[i] < dth ) { status = 1; ++minima; } break;
      case 1: if( data[i] > uth ) status = 0; break;
      }
  return minima;
  }


bool Profile::straight( int * const dyp )
  {
  if( limit_ < 0 ) initialize();
  if( samples() < 5 ) return false;

  const int xl = ( samples() / 30 ) + 1, yl = ( data[xl] + data[xl+1] ) / 2 ;
  const int xr = samples() - xl - 1,     yr = ( data[xr-1] + data[xr] ) / 2 ;
  const int dx = xr - xl, dy = yr - yl;
  if( dx <= 0 ) return false;
  const int dmax = dx * ( ( samples() / 20 ) + 2 );
  int faults = samples() / 10;
  for( int i = 0; i < samples(); ++i )
    {
    int y = ( dx * yl ) + ( ( i - xl ) * dy );
    int d = std::abs( ( dx * data[i] ) - y );
    if( d >= dmax && ( ( dx * data[i] ) < y || ( i >= xl && i <= xr ) ) )
      if( d > dmax || ( d == dmax && --faults < 0 ) ) return false;
    }
  if( dyp ) *dyp = dy;
  return true;
  }
