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

#include "common.h"
#include "rational.h"
#include "rectangle.h"
#include "track.h"
#include "ucs.h"
#include "bitmap.h"
#include "blob.h"
#include "character.h"
#include "page_image.h"
#include "textline.h"


namespace {

// Return the character position >= first preceding a big gap or eol.
//
int find_big_gap( const Textline & line, const int first,
                  const int space_width_limit )
  {
  int i = first;
  while( i + 1 < line.characters() )
    {
    const Character & c1 = line.character( i );
    const Character & c2 = line.character( i + 1 );
    const int gap = c2.left() - c1.right() - 1;
    if( gap > space_width_limit ) break; else ++i;
    }
  return i;
  }

} // end namespace


Textline::Textline( const Textline & tl )
  : Track( tl ), big_initials_( tl.big_initials_ )
  {
  cpv.reserve( tl.cpv.size() );
  for( unsigned i = 0; i < tl.cpv.size(); ++i )
    cpv.push_back( new Character( *tl.cpv[i] ) );
  }


Textline & Textline::operator=( const Textline & tl )
  {
  if( this != &tl )
    {
    Track::operator=( tl );
    big_initials_ = tl.big_initials_;
    for( unsigned i = 0; i < cpv.size(); ++i ) delete cpv[i];
    cpv.clear();
    cpv.reserve( tl.cpv.size() );
    for( unsigned i = 0; i < tl.cpv.size(); ++i )
      cpv.push_back( new Character( *tl.cpv[i] ) );
    }
  return *this;
  }


Textline::~Textline()
  {
  for( unsigned i = 0; i < cpv.size(); ++i ) delete cpv[i];
  }


void Textline::set_track()
  {
  std::vector< Rectangle > rv;
  for( unsigned i = big_initials_; i < cpv.size(); ++i )
    if( !cpv[i]->maybe(' ') ) rv.push_back( *cpv[i] );
  Track::set_track( rv );
  }


void Textline::verify_big_initials()
  {
  while( big_initials_ > 0 &&
         cpv[big_initials_-1]->height() <= 2 * mean_height() )
    --big_initials_;
  }


Character & Textline::character( const int i ) const
  {
  if( i < 0 || i >= characters() )
    Ocrad::internal_error( "character, index out of bounds" );
  return *cpv[i];
  }


Character * Textline::character_at( const int col ) const
  {
  for( int i = 0; i < characters(); ++i )
    if( cpv[i]->h_includes( col ) ) return cpv[i];
  return 0;
  }


Rectangle Textline::charbox( const Character & c ) const
  {
  return Rectangle( c.left(), top( c.hcenter() ), c.right(), bottom( c.hcenter() ) );
  }


void Textline::delete_character( const int i )
  {
  if( i < 0 || i >= characters() )
    Ocrad::internal_error( "delete_character, index out of bounds" );
  if( i < big_initials_ ) --big_initials_;
  delete cpv[i]; cpv.erase( cpv.begin() + i );
  }


int Textline::shift_characterp( Character * const p, const bool big )
  {
  int i = characters();

  while( i > 0 && p->h_precedes( *cpv[i-1] ) ) --i;
  cpv.insert( cpv.begin() + i, p );
  if( i < big_initials_ ) ++big_initials_;
  else if( big ) big_initials_ = i + 1;
  return i;
  }


bool Textline::insert_space( const int i, const bool tab )
  {
  if( i <= 0 || i >= characters() )
    Ocrad::internal_error( "insert_space, index out of bounds" );
  if( !height() )
    Ocrad::internal_error( "insert_space, track not set yet" );
  Character & c1 = *cpv[i-1];
  Character & c2 = *cpv[i];
  int l = c1.right() + 1;
  int r = c2.left() - 1;
  if( l > r ) return false;
  int t = top( ( l + r ) / 2 );
  int b = bottom( ( l + r ) / 2 );
  Rectangle re( l, t, r, b );
  Character * const p = new Character( re, ' ', tab ? 1 : 0 );
  if( tab ) p->add_guess( '\t', 0 );
  cpv.insert( cpv.begin() + i, p );
  return true;
  }


// Insert spaces between characters.
//
void Textline::insert_spaces()
  {
  const Rational mw = mean_width();
  if( mw < 2 ) return;
  const int mwt = mw.trunc();
  const int space_width_limit = ( 3 * mw ).trunc();
  int first = big_initials_;
  while( first + 1 < characters() )
    {
    int last = find_big_gap( *this, first, space_width_limit );
    const Rational mg = mean_gap_width( first, last );
    if( first < last && mg >= 0 )
      {
      int spaces = 0, nospaces = 0, spsum = 0, nospsum = 0;
      for( int i = first ; i < last; ++i )
        {
        const Character & c1 = character( i );
        const Character & c2 = character( i + 1 );
        const int gap = c2.left() - c1.right() - 1;
        if( gap >= mwt || gap > 3 * mg ||
            ( 5 * gap > 2 * mw && gap > 2 * mg ) ||
            ( 3 * c1.width() > 2 * mw && 3 * c2.width() > 2 * mw && 2 * gap > mw && 5 * gap > 8 * mg ) )
          { ++spaces; spsum += gap;
            if( insert_space( i + 1 ) ) { ++i; ++last; } }
        else { ++nospaces; nospsum += gap; }
        }
      if( spaces && nospaces )
        {
        const Rational th = ( Rational( 3 * spsum, spaces ) + Rational( nospsum, nospaces ) ) / 4;
        for( int i = first ; i < last; ++i )
          {
          const Character & c1 = character( i );
          const Character & c2 = character( i + 1 );
          const int gap = c2.left() - c1.right() - 1;
          if( gap > th && insert_space( i + 1 ) ) { ++i; ++last; }
          }
        }
      }
    if( ++last < characters() && insert_space( last, true ) ) ++last;
    first = last;
    }
  }


void Textline::join( Textline & tl )
  {
  for( int i = 0; i < tl.characters(); ++i )
    shift_characterp( tl.cpv[i], i < tl.big_initials_ );
  tl.big_initials_ = 0; tl.cpv.clear();
  }


int Textline::mean_height() const
  {
  int c = 0, sum = 0;

  for( int i = big_initials_; i < characters(); ++i )
    if( !cpv[i]->maybe(' ') ) { ++c; sum += cpv[i]->height(); }
  if( c ) sum /= c;
  return sum;
  }


Rational Textline::mean_width() const
  {
  int c = 0, sum = 0;

  for( int i = big_initials_; i < characters(); ++i )
    if( !cpv[i]->maybe(' ') ) { ++c; sum += cpv[i]->width(); }

  if( c ) return Rational( sum, c );
  return Rational( 0 );
  }


Rational Textline::mean_gap_width( const int first, int last ) const
  {
  if( last < 0 ) last = characters() - 1;
  int sum = 0;

  for( int i = first; i < last; ++i )
    sum += std::max( 0, cpv[i+1]->left() - cpv[i]->right() - 1 );

  if( last > first ) return Rational( sum, last - first );
  return Rational( 0 );
  }


int Textline::mean_hcenter() const
  {
  int c = 0, sum = 0;

  for( int i = big_initials_; i < characters(); ++i )
    { ++c; sum += cpv[i]->hcenter(); }
  if( c ) sum /= c;
  return sum;
  }


int Textline::mean_vcenter() const
  {
  int c = 0, sum = 0;

  for( int i = big_initials_; i < characters(); ++i )
    { ++c; sum += cpv[i]->vcenter(); }
  if( c ) sum /= c;
  return sum;
  }


void Textline::print( const Control & control ) const
  {
  for( int i = 0; i < characters(); ++i ) character( i ).print( control );
  std::fputs( "\n", control.outfile );
  }


void Textline::dprint( const Control & control, const bool graph,
                       const bool recursive ) const
  {
  if( graph || recursive )
    std::fprintf( control.outfile, "mean height = %d, track segments = %d\n",
                  mean_height(), segments() );

  for( int i = 0; i < characters(); ++i )
    {
    const Character & c = character( i );
    if( i < big_initials_ ) c.dprint( control, c, graph, recursive );
    else c.dprint( control, charbox( c ), graph, recursive );
    }
  std::fputs( "\n", control.outfile );
  }


void Textline::xprint( const Control & control ) const
  {
  for( int i = 0; i < characters(); ++i )
    character( i ).xprint( control );
  }


void Textline::cmark( Page_image & page_image ) const
  {
  for( int i = 0; i < characters(); ++i )
    page_image.draw_rectangle( character( i ) );
  }


void Textline::recognize1( const Charset & charset ) const
  {
  for( int i = 0; i < characters(); ++i )
    {
    Character & c = character( i );
    if( i < big_initials_ )
      {
      c.recognize1( charset, c );
      if( c.guesses() )
        {
        const int code = c.guess( 0 ).code;
        if( UCS::islower_ambiguous( code ) )
          c.only_guess( UCS::toupper( code ), 0 );
        }
      }
    else c.recognize1( charset, charbox( c ) );
    }
  }


void Textline::apply_filter( const Filter & filter )
  {
  bool flag = false;
  for( int i = 0; i < characters(); )
    {
    Character & c = character( i );
    const int guesses = c.guesses();
    c.apply_filter( filter );
    if( guesses && !c.guesses() ) { delete_character( i ); flag = true; }
    else ++i;
    }
  if( flag )
    for( int i = characters() - 1; i >= 0; --i )
      if( character(i).maybe(' ') &&
          ( i >= characters() - 1 || ( i > 0 && character(i-1).maybe(' ') ) ) )
        delete_character( i );
  }
