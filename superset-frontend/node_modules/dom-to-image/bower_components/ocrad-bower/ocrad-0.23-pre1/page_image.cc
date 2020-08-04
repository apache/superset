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
#include <climits>
#include <cstdio>
#include <string>
#include <vector>
#include <stdint.h>

#include "ocradlib.h"
#include "common.h"
#include "rational.h"
#include "rectangle.h"
#include "segment.h"
#include "mask.h"
#include "track.h"
#include "page_image.h"


namespace {

// binarization by Otsu's method based on maximization of inter-class variance
//
int otsu_th( const std::vector< std::vector< uint8_t > > & data,
             const Rectangle & re, const int maxval )
  {
  if( maxval == 1 ) return 0;

  std::vector< int > hist( maxval + 1, 0 );	// histogram of image data
  for( int row = re.top(); row <= re.bottom(); ++row )
    for( int col = re.left(); col <= re.right(); ++col )
      ++hist[data[row][col]];

  std::vector< int > chist;		// cumulative histogram
  chist.reserve( maxval + 1 );
  chist.push_back( hist[0] );
  std::vector< long long > cmom;	// cumulative moment
  cmom.reserve( maxval + 1 );
  cmom.push_back( 0 );			// 0 times hist[0] equals zero
  for( int i = 1; i <= maxval; ++i )
    {
    chist.push_back( chist[i-1] + hist[i] );
    cmom.push_back( cmom[i-1] + ( i * hist[i] ) );
    }

  const double cmom_max = cmom[maxval];
  double bvar_max = 0;
  int threshold = 0;			// threshold for binarization
  for( int i = 0; i < maxval; ++i )
    if( chist[i] > 0 && chist[i] < re.size() )
      {
      double bvar = (double)cmom[i] / chist[i];
      bvar -= ( cmom_max - cmom[i] ) / ( re.size() - chist[i] );
      bvar *= bvar; bvar *= chist[i]; bvar *= ( re.size() - chist[i] );
      if( bvar > bvar_max ) { bvar_max = bvar; threshold = i; }
      }

  return threshold;
  }


int absolute_pos( Rational pos, const int left, const int right )
  {
  int a;

  if( pos >= 0 )
    {
    if( pos <= 1 ) a = left + ( pos * ( right - left ) ).trunc();
    else a = left + pos.round();
    }
  else
    {
    pos = -pos;
    if( pos <= 1 ) a = right - ( pos * ( right - left ) ).trunc();
    else a = right - pos.round();
    }
  return a;
  }


void convol_23( std::vector< std::vector< uint8_t > > & data, const int scale )
  {
  const int height = data.size();
  const int width = data[0].size();
  if( height < 3 || width < 3 ) return;

  std::vector< std::vector< uint8_t > > new_data( height );
  new_data[0] = data[0];				// copy first row
  for( int row = 1; row < height - 1; ++row )
    new_data[row].reserve( width );
  new_data[height-1] = data[height-1];			// copy last row

  for( int row = 1; row < height - 1; ++row )
    {
    const std::vector< uint8_t > & datarow1 = data[row-1];
    const std::vector< uint8_t > & datarow2 = data[row];
    const std::vector< uint8_t > & datarow3 = data[row+1];
    std::vector< uint8_t > & new_datarow = new_data[row];
    new_datarow.push_back( datarow2[0] );		// copy first col
    if( scale < 3 )
      for( int col = 1; col < width - 1; ++col )
        {
        int sum = datarow1[col-1] + datarow1[col] + datarow1[col+1] +
                  datarow2[col-1] + 2 * datarow2[col] + datarow2[col+1] +
                  datarow3[col-1] + datarow3[col] + datarow3[col+1];
        new_datarow.push_back( ( sum + 5 ) / 10 );
        }
    else
      for( int col = 1; col < width - 1; ++col )
        {
        int sum = datarow1[col-1] + datarow1[col] + datarow1[col+1] +
                  datarow2[col-1] + datarow2[col] + datarow2[col+1] +
                  datarow3[col-1] + datarow3[col] + datarow3[col+1];
        new_datarow.push_back( ( 2 * sum + 9 ) / 18 );
        }
    new_datarow.push_back( datarow2[width-1] );		// copy last col
    }
  data.swap( new_data );
  }


void convol_n( std::vector< std::vector< uint8_t > > & data, const int scale )
  {
  const int radius = scale / 2;		// this is really radius - 0.5
  const int min_size = 2 * radius + 1;
  const int area = min_size * min_size;
  const int height = data.size();
  const int width = data[0].size();
  if( radius < 1 || height < min_size || width < min_size ) return;

  std::vector< std::vector< uint8_t > > new_data( height );
  for( int row = 0; row < radius; ++row )
    new_data[row] = data[row];				// copy first rows
  for( int row = radius; row < height - radius; ++row )
    new_data[row].reserve( width );
  for( int row = height - radius; row < height; ++row )
    new_data[row] = data[row];				// copy last rows

  for( int row = radius; row < height - radius; ++row )
    {
    const std::vector< uint8_t > & datarow = data[row];
    std::vector< uint8_t > & new_datarow = new_data[row];
    for( int col = 0; col < radius; ++col )
      new_datarow.push_back( datarow[col] );		// copy first cols
    for( int col = radius; col < width - radius; ++col )
      {
      int sum = 0;
      for( int r = -radius; r < radius; ++r )
        for( int c = -radius; c < radius; ++c )
          sum += data[row+r][col+c];
      new_datarow.push_back( ( 2 * sum + area ) / ( 2 * area ) );
      }
    for( int col = width - radius; col < width; ++col )
      new_datarow.push_back( datarow[col] );		// copy last cols
    }
  data.swap( new_data );
  }


void enlarge_2b( std::vector< std::vector< uint8_t > > & data )
  {
  const int height = data.size();
  const int width = data[0].size();
  std::vector< std::vector< uint8_t > > new_data( 2 * height );

  for( unsigned row = 0; row < new_data.size(); ++row )
    new_data[row].resize( 2 * width, 1 );

  for( int row = 0; row < height; ++row )
    {
    const std::vector< uint8_t > & datarow = data[row];
    std::vector< uint8_t > & new_datarow0 = new_data[2*row];
    std::vector< uint8_t > & new_datarow1 = new_data[2*row+1];
    for( int col = 0; col < width; ++col )
      {
      if( datarow[col] == 0 )
        {
        const bool l = col > 0 && datarow[col-1] == 0;
        const bool t = row > 0 && data[row-1][col] == 0;
        const bool r = col < width - 1 && datarow[col+1] == 0;
        const bool b = row < height - 1 && data[row+1][col] == 0;
        const bool lt = row > 0 && col > 0 && data[row-1][col-1] == 0;
        const bool rt = row > 0 && col < width - 1 && data[row-1][col+1] == 0;
        const bool lb = row < height - 1 && col > 0 && data[row+1][col-1] == 0;
        const bool rb = row < height - 1 && col < width - 1 && data[row+1][col+1] == 0;

        if( l || t || lt || ( !rt && !lb ) ) new_datarow0[2*col] = 0;
        if( r || t || rt || ( !lt && !rb ) ) new_datarow0[2*col+1] = 0;
        if( l || b || lb || ( !lt && !rb ) ) new_datarow1[2*col] = 0;
        if( r || b || rb || ( !rt && !lb ) ) new_datarow1[2*col+1] = 0;
        }
      }
    }
  data.swap( new_data );
  }


void enlarge_3b( std::vector< std::vector< uint8_t > > & data )
  {
  const int height = data.size();
  const int width = data[0].size();
  std::vector< std::vector< uint8_t > > new_data( 3 * height );

  for( unsigned row = 0; row < new_data.size(); ++row )
    new_data[row].resize( 3 * width, 1 );

  for( int row = 0; row < height; ++row )
    {
    const int row3 = 3 * row;
    const std::vector< uint8_t > & datarow = data[row];
    std::vector< uint8_t > & new_datarow0 = new_data[row3];
    std::vector< uint8_t > & new_datarow1 = new_data[row3+1];
    std::vector< uint8_t > & new_datarow2 = new_data[row3+2];
    for( int col = 0; col < width; ++col )
      {
      const int col3 = 3 * col;
      const bool l = col > 0 && datarow[col-1] == 0;
      const bool t = row > 0 && data[row-1][col] == 0;
      const bool r = col < width - 1 && datarow[col+1] == 0;
      const bool b = row < height - 1 && data[row+1][col] == 0;
      const bool lt = row > 0 && col > 0 && data[row-1][col-1] == 0;
      const bool rt = row > 0 && col < width - 1 && data[row-1][col+1] == 0;
      const bool lb = row < height - 1 && col > 0 && data[row+1][col-1] == 0;
      const bool rb = row < height - 1 && col < width - 1 && data[row+1][col+1] == 0;
      if( datarow[col] == 0 )
        {
        if( l || t || lt || ( !rt && !lb ) ) new_datarow0[col3] = 0;
        new_datarow0[col3+1] = 0;
        if( r || t || rt || ( !lt && !rb ) ) new_datarow0[col3+2] = 0;
        new_datarow1[col3] = new_datarow1[col3+1] = new_datarow1[col3+2] = 0;
        if( l || b || lb || ( !lt && !rb ) ) new_datarow2[col3] = 0;
        new_datarow2[col3+1] = 0;
        if( r || b || rb || ( !rt && !lb ) ) new_datarow2[col3+2] = 0;
        }
      else
        {
        if( l && t && lt && ( !rt || !lb ) ) new_datarow0[col3] = 0;
        if( r && t && rt && ( !lt || !rb ) ) new_datarow0[col3+2] = 0;
        if( l && b && lb && ( !lt || !rb ) ) new_datarow2[col3] = 0;
        if( r && b && rb && ( !rt || !lb ) ) new_datarow2[col3+2] = 0;
        }
      }
    }
  data.swap( new_data );
  }


void enlarge_n( std::vector< std::vector< uint8_t > > & data, const int n )
  {
  if( n < 2 ) return;
  const int height = data.size();
  const int width = data[0].size();
  std::vector< std::vector< uint8_t > > new_data;
  new_data.reserve( n * height );

  for( int row = 0; row < height; ++row )
    {
    const std::vector< uint8_t > & datarow = data[row];
    new_data.push_back( std::vector< uint8_t >() );
    for( int col = 0; col < width; ++col )
      {
      const uint8_t d = datarow[col];
      for( int i = 0; i < n; ++i ) new_data.back().push_back( d );
      }
    for( int i = 1; i < n; ++i ) new_data.push_back( new_data.back() );
    }
  data.swap( new_data );
  }


void mirror_left_right( std::vector< std::vector< uint8_t > > & data )
  {
  const int height = data.size();
  for( int row = 0; row < height; ++row )
    std::reverse( data[row].begin(), data[row].end() );
  }


void mirror_top_bottom( std::vector< std::vector< uint8_t > > & data )
  {
  for( int u = 0, d = data.size() - 1; u < d; ++u, --d )
    data[u].swap( data[d] );
  }


void mirror_diagonal( std::vector< std::vector< uint8_t > > & data,
                      Rectangle & re )
  {
  const int size = std::max( re.height(), re.width() );

  if( re.height() < size )
    {
    data.resize( size );
    for( int row = re.height(); row < size; ++row )
      data[row].resize( size );
    }
  else if( re.width() < size )
    for( int row = 0; row < re.height(); ++row )
      data[row].resize( size );

  for( int row = 0; row < size; ++row )
    {
    std::vector< uint8_t > & datarow = data[row];
    for( int col = 0; col < row; ++col )
      {
      uint8_t tmp = datarow[col];
      datarow[col] = data[col][row]; data[col][row] = tmp;
      }
    }

  const int h = re.height(), w = re.width();
  re.height( w ); re.width( h );
  if( re.height() < size ) data.resize( re.height() );
  else if( re.width() < size )
    for( int row = 0; row < re.height(); ++row )
      data[row].resize( re.width() );
  }

} // end namespace


// Creates a Page_image from a OCRAD_Pixmap
//
Page_image::Page_image( const OCRAD_Pixmap & image, const bool invert )
  : Rectangle( 0, 0, image.width - 1, image.height - 1 )
  {
  data.resize( height() );
  for( unsigned row = 0; row < data.size(); ++row )
    data[row].reserve( width() );
  const int rows = height(), cols = width();

  switch( image.mode )
    {
    case OCRAD_bitmap: {
      maxval_ = 1; threshold_ = 0;
      if( !invert )
        for( int i = 0, row = 0; row < rows; ++row )
          for( int col = 0; col < cols; ++col, ++i )
            data[row].push_back( image.data[i] ? 0 : 1 );
      else
        for( int i = 0, row = 0; row < rows; ++row )
          for( int col = 0; col < cols; ++col, ++i )
            data[row].push_back( image.data[i] ? 1 : 0 );
      } break;
    case OCRAD_greymap: {
      maxval_ = 255; threshold_ = 127;
      if( !invert )
        for( int i = 0, row = 0; row < rows; ++row )
          for( int col = 0; col < cols; ++col, ++i )
            data[row].push_back( image.data[i] );
      else
        for( int i = 0, row = 0; row < rows; ++row )
          for( int col = 0; col < cols; ++col, ++i )
            data[row].push_back( maxval_ - image.data[i] );
      } break;
    case OCRAD_colormap: {
      maxval_ = 255; threshold_ = 127;
      for( int i = 0, row = 0; row < rows; ++row )
        for( int col = 0; col < cols; ++col, i += 3 )
          {
          const uint8_t r = image.data[i];		// Red value
          const uint8_t g = image.data[i+1];		// Green value
          const uint8_t b = image.data[i+2];		// Blue value
          uint8_t val;
          if( !invert ) val = std::min( r, std::min( g, b ) );
          else val = maxval_ - std::max( r, std::max( g, b ) );
          data[row].push_back( val );
          }
      } break;
    }
  }


// Creates a reduced Page_image
//
Page_image::Page_image( const Page_image & source, const int scale )
  : Rectangle( source ), maxval_( source.maxval_ ), threshold_( source.threshold_ )
  {
  if( scale < 2 || scale > source.width() || scale > source.height() )
    Ocrad::internal_error( "bad parameter building a reduced Page_image" );

  const int scale2 = scale * scale;
  Rectangle::height( source.height() / scale );
  Rectangle::width( source.width() / scale );

  data.resize( height() );
  for( int row = 0; row < height(); ++row )
    {
    const int srow = ( row * scale ) + scale;
    data[row].reserve( width() );
    std::vector< uint8_t > & datarow = data[row];
    for( int col = 0; col < width(); ++col )
      {
      const int scol = ( col * scale ) + scale;
      int sum = 0;
      for( int i = srow - scale; i < srow; ++i )
        {
        const std::vector< uint8_t > & sdatarow = source.data[i];
        for( int j = scol - scale; j < scol; ++j )
          sum += sdatarow[j];
        }
      datarow.push_back( sum / scale2 );
      }
    }
  }


void Page_image::threshold( const Rational & th )
  {
  if( th >= 0 && th <= 1 )
    threshold_ = ( th * maxval_ ).trunc();
  else
    threshold_ = otsu_th( data, *this, maxval_ );
  }


void Page_image::threshold( const int th )
  {
  if( th >= 0 && th <= 255 ) threshold_ = ( th * maxval_ ) / 255;
  else threshold_ = otsu_th( data, *this, maxval_ );
  }


bool Page_image::cut( const Rational ltwh[4] )
  {
  Rectangle re = *this;

  const int l = absolute_pos( ltwh[0], left(), right() );
  if( l > re.left() ) { if( l < re.right() ) re.left( l ); else return false; }

  const int t = absolute_pos( ltwh[1], top(), bottom() );
  if( t > re.top() ) { if( t < re.bottom() ) re.top( t ); else return false; }

  const int r = l + absolute_pos( ltwh[2], left(), right() ) - 1;
  if( r < re.right() ) { if( r > re.left() ) re.right( r ); else return false; }

  const int b = t + absolute_pos( ltwh[3], top(), bottom() ) - 1;
  if( b < re.bottom() ) { if( b > re.top() ) re.bottom( b ); else return false; }

  if( re.width() < 3 || re.height() < 3 ) return false;

  // cutting is performed here
  if( re.bottom() < bottom() ) data.resize( re.bottom() - top() + 1 );
  if( re.right() < right() )
    {
    const int w = re.right() - left() + 1;
    for( int row = data.size() - 1; row >= 0 ; --row ) data[row].resize( w );
    }
  if( re.top() > top() )
    data.erase( data.begin(), data.begin() + ( re.top() - top() ) );
  if( re.left() > left() )
    {
    const int d = re.left() - left();
    for( int row = data.size() - 1; row >= 0 ; --row )
      data[row].erase( data[row].begin(), data[row].begin() + d );
    }
  Rectangle::left( 0 );
  Rectangle::top( 0 );
  Rectangle::right( data[0].size() - 1 );
  Rectangle::bottom( data.size() - 1 );

  return true;
  }


void Page_image::draw_mask( const Mask & m )
  {
  const int t = std::max( top(), m.top() );
  const int b = std::min( bottom(), m.bottom() );
  if( t == m.top() && m.left( t ) >= 0 && m.right( t ) >= 0 )
    for( int col = m.left( t ); col <= m.right( t ); ++col )
      set_bit( t, col, true );
  if( b == m.bottom() && m.left( b ) >= 0 && m.right( b ) >= 0 )
    for( int col = m.left( b ); col <= m.right( b ); ++col )
      set_bit( b, col, true );

  int lprev = m.left( t );
  int rprev = m.right( t );
  for( int row = t + 1; row <= b; ++row )
    {
    int lnew = m.left( row ), rnew = m.right( row );
    if( lnew < 0 ) lnew = lprev;
    if( rnew < 0 ) rnew = rprev;
    if( lprev >= 0 && lnew >= 0 )
      {
      int c1 = std::max( left(), std::min( lprev, lnew ) );
      int c2 = std::min( right(), std::max( lprev, lnew ) );
      for( int col = c1; col <= c2; ++col )
        set_bit( row, col, true );
      }
    if( rprev >= 0 && rnew >= 0 )
      {
      int c1 = std::max( left(), std::min( rprev, rnew ) );
      int c2 = std::min( right(), std::max( rprev, rnew ) );
      for( int col = c1; col <= c2; ++col )
        set_bit( row, col, true );
      }
    lprev = lnew; rprev = rnew;
    }
  }


void Page_image::draw_rectangle( const Rectangle & re )
  {
  const int l = std::max( left(), re.left() );
  const int t = std::max( top(), re.top() );
  const int r = std::min( right(), re.right() );
  const int b = std::min( bottom(), re.bottom() );
  if( l == re.left() )
    for( int row = t; row <= b; ++row ) set_bit( row, l, true );
  if( t == re.top() )
    for( int col = l; col <= r; ++col ) set_bit( t, col, true );
  if( r == re.right() )
    for( int row = t; row <= b; ++row ) set_bit( row, r, true );
  if( b == re.bottom() )
    for( int col = l; col <= r; ++col ) set_bit( b, col, true );
  }


void Page_image::draw_track( const Track & tr )
  {
  int l = std::max( left(), tr.left() );
  int r = std::min( right(), tr.right() );
  if( l == tr.left() )
    for( int row = tr.top( l ); row <= tr.bottom( l ); ++row )
      if( row >= top() && row <= bottom() ) set_bit( row, l, true );
  if( r == tr.right() )
    for( int row = tr.top( r ); row <= tr.bottom( r ); ++row )
      if( row >= top() && row <= bottom() ) set_bit( row, r, true );
  for( int col = l; col <= r; ++col )
    {
    int row = tr.top( col );
    if( row >= top() && row <= bottom() ) set_bit( row, col, true );
    row = tr.bottom( col );
    if( row >= top() && row <= bottom() ) set_bit( row, col, true );
    }
  }


bool Page_image::scale( int n )
  {
  if( n <= -2 )
    { Page_image reduced( *this, -n ); *this = reduced; return true; }
  if( n >= 2 )
    {
    if( INT_MAX / n < width() * height() )
      throw Error( "scale factor too big. 'int' will overflow." );
    if( maxval_ == 1 )
      {
      if( n && ( n % 2 ) == 0 ) { enlarge_2b( data ); n /= 2; }
      else if( n && ( n % 3 ) == 0 ) { enlarge_3b( data ); n /= 3; }
      }
    if( n >= 2 )
      {
      enlarge_n( data, n );
      if( maxval_ > 1 )
        { if( n <= 3 ) convol_23( data, n ); else convol_n( data, n ); }
      }
    Rectangle::height( data.size() );
    Rectangle::width( data[0].size() );
    return true;
    }
  return false;
  }


void Page_image::transform( const Transformation & t )
  {
  switch( t.type() )
    {
    case Transformation::none:
      break;
    case Transformation::rotate90:
      mirror_diagonal( data, *this ); mirror_top_bottom( data ); break;
    case Transformation::rotate180:
      mirror_left_right( data ); mirror_top_bottom( data ); break;
    case Transformation::rotate270:
      mirror_diagonal( data, *this ); mirror_left_right( data ); break;
    case Transformation::mirror_lr:
      mirror_left_right( data ); break;
    case Transformation::mirror_tb:
      mirror_top_bottom( data ); break;
    case Transformation::mirror_d1:
      mirror_diagonal( data, *this ); break;
    case Transformation::mirror_d2:
      mirror_diagonal( data, *this );
      mirror_left_right( data ); mirror_top_bottom( data ); break;
    }
  }
