/*  Rational - Rational number class with overflow detection.
    Copyright (C) 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013
    Antonio Diaz Diaz.

    This library is free software: you have unlimited permission to
    copy, distribute and modify it.

    This library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
*/

#include <algorithm>
#include <cctype>
#include <climits>
#include <cstdlib>
#include <string>

#include "rational.h"

#ifndef LLONG_MAX
#define LLONG_MAX  0x7FFFFFFFFFFFFFFFLL
#endif
#ifndef LLONG_MIN
#define LLONG_MIN  (-LLONG_MAX - 1LL)
#endif
#ifndef ULLONG_MAX
#define ULLONG_MAX 0xFFFFFFFFFFFFFFFFULL
#endif


namespace {

int gcd( int n, int m )				// Greatest Common Divisor
  {
  if( n < 0 ) n = -n;
  if( m < 0 ) m = -m;

  while( true )
    {
    if( m ) n %= m; else return n;
    if( n ) m %= n; else return m;
    }
  }


long long llgcd( long long n, long long m )	// Greatest Common Divisor
  {
  if( n < 0 ) n = -n;
  if( m < 0 ) m = -m;

  while( true )
    {
    if( m ) n %= m; else return n;
    if( n ) m %= n; else return m;
    }
  }


const std::string overflow_string( const int n )
  { if( n > 0 ) return "+INF"; if( n < 0 ) return "-INF"; return "NAN"; }

int overflow_value( const int n )
  { if( n > 0 ) return INT_MAX; if( n < 0 ) return -INT_MAX; return 0; }

int lloverflow_value( const long long n )
  { if( n > 0 ) return INT_MAX; if( n < 0 ) return -INT_MAX; return 0; }

} // end namespace


void Rational::normalize( long long n, long long d )
  {
  if( d == 0 ) { num = lloverflow_value( n ); den = 0; return; }  // set error
  if( n == 0 ) { num = 0; den = 1; return; }
  if( d != 1 )
    {
    const long long tmp = llgcd( n, d );
    n /= tmp; d /= tmp;
    }

  if( n <= INT_MAX && n >= -INT_MAX && d <= INT_MAX && d >= -INT_MAX )
    { if( d >= 0 ) { num = n; den = d; } else { num = -n; den = -d; } }
  else
    { num = lloverflow_value( (d >= 0) ? n : -n ); den = 0; }
  }


void Rational::normalize()
  {
  if( den == 0 ) return;			// no op on error
  if( num == 0 ) { den = 1; return; }
  if( num < -INT_MAX )
    {
    if( den < -INT_MAX ) den = -INT_MAX;
    num = overflow_value( -den ); den = 0; return;
    }
  if( den < 0 )
    {
    if( den < -INT_MAX ) { num = overflow_value( -num ); den = 0; return; }
    num = -num; den = -den;
    }
  if( den != 1 )
    {
    const int tmp = gcd( num, den );
    num /= tmp; den /= tmp;
    }
  }


Rational Rational::inverse() const
  {
  if( den <= 0 ) return *this;			// no op on error
  Rational tmp;
  if( num > 0 ) { tmp.num = den; tmp.den = num; }
  else if( num < 0 ) { tmp.num = -den; tmp.den = -num; }
  else { tmp.num = overflow_value( den ); tmp.den = 0; }	// set error
  return tmp;
  }


Rational & Rational::operator+=( const Rational & r )
  {
  if( den <= 0 ) return *this;			// no op on error
  if( r.den <= 0 ) { num = r.num; den = 0; return *this; }	// set error

  const long long new_den = (long long)den * r.den;
  const long long new_num = ( (long long)num * r.den ) +
                            ( (long long)r.num * den );
  normalize( new_num, new_den );
  return *this;
  }


Rational & Rational::operator*=( const Rational & r )
  {
  if( den <= 0 ) return *this;			// no op on error
  if( r.den <= 0 ) { num = r.num; den = 0; return *this; }	// set error

  const long long new_num = (long long)num * r.num;
  const long long new_den = (long long)den * r.den;
  normalize( new_num, new_den );
  return *this;
  }


int Rational::round() const
  {
  if( den <= 0 ) return num;
  int result = num / den;
  const int rest = std::abs( num ) % den;
  if( rest > 0 && rest >= den - rest )
    { if( num >= 0 ) ++result; else --result; }
  return result;
  }


// Recognized formats: 123 123/456 123.456 .123 12% 12/3% 12.3% .12%
// Values may be preceded by an optional '+' or '-' sign.
// Returns the number of chars read from 's', or 0 if input is invalid.
// In case of invalid input, the Rational is not changed.
//
int Rational::parse( const char * const s )
  {
  if( !s || !s[0] ) return 0;
  long long n = 0, d = 1;		// restrain intermediate overflow
  int c = 0;
  bool minus = false;

  while( std::isspace( s[c] ) ) ++c;
  if( s[c] == '+' ) ++c;
  else if( s[c] == '-' ) { ++c; minus = true; }
  if( !std::isdigit( s[c] ) && s[c] != '.' ) return 0;

  while( std::isdigit( s[c] ) )
    {
    if( ( LLONG_MAX - (s[c] - '0') ) / 10 < n ) return 0;
    n = (n * 10) + (s[c] - '0'); ++c;
    }

  if( s[c] == '.' )
    {
    ++c; if( !std::isdigit( s[c] ) ) return 0;
    while( std::isdigit( s[c] ) )
      {
      if( ( LLONG_MAX - (s[c] - '0') ) / 10 < n || LLONG_MAX / 10 < d )
        return 0;
      n = (n * 10) + (s[c] - '0'); d *= 10; ++c;
      }
    }
  else if( s[c] == '/' )
    {
    ++c; d = 0;
    while( std::isdigit( s[c] ) )
      {
      if( ( LLONG_MAX - (s[c] - '0') ) / 10 < d ) return 0;
      d = (d * 10) + (s[c] - '0'); ++c;
      }
    if( d == 0 ) return 0;
    }

  if( s[c] == '%' )
    {
    ++c;
    if( n % 100 == 0 ) n /= 100;
    else if( n % 10 == 0 && LLONG_MAX / 10 >= d ) { n /= 10; d *= 10; }
    else if( LLONG_MAX / 100 >= d ) d *= 100;
    else return 0;
    }

  if( minus ) n = -n;
  Rational tmp; tmp.normalize( n, d );
  if( !tmp.error() ) { *this = tmp; return c; }
  return 0;
  }


// Returns a string representing the value 'num/den' in decimal point
// format with 'prec' decimals.
// 'iwidth' is the minimum width of the integer part, prefixed with
// spaces if needed.
// If 'prec' is negative, only the needed decimals are produced.
//
const std::string Rational::to_decimal( const unsigned iwidth, int prec ) const
  {
  if( den <= 0 ) return overflow_string( num );

  std::string s;
  int ipart = std::abs( num / den );
  const bool truncate = ( prec < 0 );
  if( prec < 0 ) prec = -prec;

  do { s += '0' + ( ipart % 10 ); ipart /= 10; } while( ipart > 0 );
  if( num < 0 ) s += '-';
  if( iwidth > s.size() ) s.append( iwidth - s.size(), ' ' );
  std::reverse( s.begin(), s.end() );
  long long rest = std::abs( num ) % den;
  if( prec > 0 && ( rest > 0 || !truncate ) )
    {
    s += '.';
    while( prec > 0 && ( rest > 0 || !truncate ) )
      { rest *= 10; s += '0' + ( rest / den ); rest %= den; --prec; }
    }
  return s;
  }


// Returns a string representing the value 'num/den' in fractional form.
// 'width' is the minimum width to be produced, prefixed with spaces if
// needed.
//
const std::string Rational::to_fraction( const unsigned width ) const
  {
  if( den <= 0 ) return overflow_string( num );

  std::string s;
  int n = std::abs( num ), d = den;

  do { s += '0' + ( d % 10 ); d /= 10; } while( d > 0 );
  s += '/';
  do { s += '0' + ( n % 10 ); n /= 10; } while( n > 0 );
  if( num < 0 ) s += '-';
  if( width > s.size() ) s.append( width - s.size(), ' ' );
  std::reverse( s.begin(), s.end() );
  return s;
  }
