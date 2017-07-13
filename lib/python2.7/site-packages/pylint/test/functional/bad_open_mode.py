"""Warnings for using open() with an invalid mode string."""

open('foo.bar', 'w', 2)
open('foo.bar', 'rw')  # [bad-open-mode]
open(name='foo.bar', buffering=10, mode='rw')  # [bad-open-mode]
open(mode='rw', name='foo.bar')  # [bad-open-mode]
open('foo.bar', 'U+')
open('foo.bar', 'rb+')
open('foo.bar', 'Uw')  # [bad-open-mode]
open('foo.bar', 2)  # [bad-open-mode]
open('foo.bar', buffering=2)
WRITE_MODE = 'w'
open('foo.bar', 'U' + WRITE_MODE + 'z')  # [bad-open-mode]
open('foo.bar', 'br')  # [bad-open-mode]
open('foo.bar', 'wU')  # [bad-open-mode]
open('foo.bar', 'r+b')
open('foo.bar', 'r+')
open('foo.bar', 'w+')
open('foo.bar', 'xb')  # [bad-open-mode]
open('foo.bar', 'rx')  # [bad-open-mode]
open('foo.bar', 'Ur')
open('foo.bar', 'rU')
open('foo.bar', 'rUb')
open('foo.bar', 'rUb+')
open('foo.bar', 'rU+b')
open('foo.bar', 'r+Ub')
open('foo.bar', '+rUb')  # [bad-open-mode]
open('foo.bar', 'ab+')
open('foo.bar', 'a+b')
open('foo.bar', 'aU')  # [bad-open-mode]
open('foo.bar', 'U+b')
open('foo.bar', '+Ub')
open('foo.bar', 'b+U')
open('foo.bar', 'Urb+')
open('foo.bar', 'Ur+b')
open('foo.bar', 'Ubr')  # [bad-open-mode]
open('foo.bar', 'Ut')  # [bad-open-mode]
