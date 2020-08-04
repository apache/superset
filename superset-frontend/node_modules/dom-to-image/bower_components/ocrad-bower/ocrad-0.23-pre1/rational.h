/*  Rational - Rational number class with overflow detection.
    Copyright (C) 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013
    Antonio Diaz Diaz.

    This library is free software: you have unlimited permission to
    copy, distribute and modify it.

    This library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
*/

// Rationals are kept normalized at all times.
// Invariant = ( gcd( num, den ) == 1 && den > 0 ).
// Range extends from INT_MAX to -INT_MAX.
// Maximum resolution is 1 / INT_MAX.
// In case of domain error or overflow, den is set to 0 and num is set
// to >0, <0 or 0, meaning +INF, -INF and NAN respectively. This error
// condition can be tested with the 'error' function, and can only be
// cleared assigning a new value to the Rational.
// While in error state, arithmetic operators become no ops and
// relational operators return false, except !=, which returns true.
//
class Rational
  {
  int num, den;

  void normalize( long long n, long long d );
  void normalize();

public:
  Rational( const int n, const int d ) : num( n ), den( d )	// n / d
    { normalize(); }
  explicit Rational( const int n ) : num( n ), den( 1 )		// n / 1
    { if( num < -INT_MAX ) { num = -INT_MAX; den = 0; } }
  Rational() : num( 0 ), den( 1 ) {}				// zero

  Rational & assign( const int n, const int d )
    { num = n; den = d; normalize(); return *this; }
  Rational & operator=( const int n )
    { num = n; den = 1; if( num < -INT_MAX ) { num = -INT_MAX; den = 0; }
      return *this; }

  int numerator() const { return num; }
  int denominator() const { return den; }
  int sign() const
    { if( num > 0 ) return 1; if( num < 0 ) return -1; return 0; }
  bool error() const { return ( den <= 0 ); }	// true if in error state

  const Rational & operator+() const { return *this; }	// unary plus const
  Rational & operator+() { return *this; }		// unary plus
  Rational operator-() const				// unary minus
    { Rational tmp( *this ); tmp.num = -tmp.num; return tmp; }

  Rational abs() const { if( num >= 0 ) return *this; else return -*this; }
  Rational inverse() const;

  Rational & operator+=( const Rational & r );
  Rational & operator-=( const Rational & r ) { return operator+=( -r ); }
  Rational & operator*=( const Rational & r );
  Rational & operator/=( const Rational & r )
    { return operator*=( r.inverse() ); }

  Rational & operator+=( const int n ) { return operator+=( Rational( n ) ); }
  Rational & operator-=( const int n ) { return operator-=( Rational( n ) ); }
  Rational & operator*=( const int n ) { return operator*=( Rational( n ) ); }
  Rational & operator/=( const int n ) { return operator/=( Rational( n ) ); }

  Rational operator+( const Rational & r ) const
    { Rational tmp( *this ); return tmp += r; }
  Rational operator-( const Rational & r ) const
    { Rational tmp( *this ); return tmp -= r; }
  Rational operator*( const Rational & r ) const
    { Rational tmp( *this ); return tmp *= r; }
  Rational operator/( const Rational & r ) const
    { Rational tmp( *this ); return tmp /= r; }

  Rational operator+( const int n ) const
    { Rational tmp( *this ); return tmp += n; }
  Rational operator-( const int n ) const
    { Rational tmp( *this ); return tmp -= n; }
  Rational operator*( const int n ) const
    { Rational tmp( *this ); return tmp *= n; }
  Rational operator/( const int n ) const
    { Rational tmp( *this ); return tmp /= n; }

  Rational & operator++() { return operator+=( 1 ); }		// prefix
  Rational operator++( int )					// suffix
    { Rational tmp( *this ); operator+=( 1 ); return tmp; }
  Rational & operator--() { return operator-=( 1 ); }		// prefix
  Rational operator--( int )					// suffix
    { Rational tmp( *this ); operator-=( 1 ); return tmp; }

  bool operator==( const Rational & r ) const
    { return ( den > 0 && num == r.num && den == r.den ); }
  bool operator==( const int n ) const
    { return ( num == n && den == 1 ); }
  bool operator!=( const Rational & r ) const
    { return ( den <= 0 || r.den <= 0 || num != r.num || den != r.den ); }
  bool operator!=( const int n ) const
    { return ( num != n || den != 1 ); }

  bool operator< ( const Rational & r ) const
    { return ( den > 0 && r.den > 0 &&
               (long long)num * r.den < (long long)r.num * den ); }
  bool operator<=( const Rational & r ) const
    { return ( *this < r || *this == r ); }
  bool operator> ( const Rational & r ) const
    { return ( den > 0 && r.den > 0 &&
               (long long)num * r.den > (long long)r.num * den ); }
  bool operator>=( const Rational & r ) const
    { return ( *this > r || *this == r ); }

  bool operator< ( const int n ) const { return operator< ( Rational( n ) ); }
  bool operator<=( const int n ) const { return operator<=( Rational( n ) ); }
  bool operator> ( const int n ) const { return operator> ( Rational( n ) ); }
  bool operator>=( const int n ) const { return operator>=( Rational( n ) ); }

  int round() const;		// nearest integer; -1.5 ==> -2,  1.5 ==> 2
  int trunc() const		// integer part;    -x.y ==> -x,  x.y ==> x
    { if( den > 0 ) return ( num / den ); else return num; }

  int parse( const char * const s );		// returns parsed size
  const std::string to_decimal( const unsigned iwidth = 1, int prec = -2 ) const;
  const std::string to_fraction( const unsigned width = 1 ) const;
  };


inline Rational operator+( const int n, const Rational & r ) { return r + n; }
inline Rational operator-( const int n, const Rational & r ) { return -r + n; }
inline Rational operator*( const int n, const Rational & r ) { return r * n; }
inline Rational operator/( const int n, const Rational & r )
  { return Rational( n ) / r; }

inline bool operator==( const int n, const Rational & r ) { return r == n; }
inline bool operator!=( const int n, const Rational & r ) { return r != n; }

inline bool operator< ( const int n, const Rational & r ) { return r >  n; }
inline bool operator<=( const int n, const Rational & r ) { return r >= n; }
inline bool operator> ( const int n, const Rational & r ) { return r <  n; }
inline bool operator>=( const int n, const Rational & r ) { return r <= n; }
