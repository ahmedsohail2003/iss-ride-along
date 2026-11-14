// IAU 1980 nutation series: all 106 terms, in units of 0.1 milliarcsecond (and the same per Julian
// century for the t coefficients). Columns: multipliers of l, l', F, D, Omega, then longitude sine
// (1, t) and obliquity cosine (1, t) coefficients.
// GENERATED, not typed: copied by a script from ERFA src/nut80.c (eraNut80), fetched 2026-11-14 from
// https://raw.githubusercontent.com/liberfa/erfa/master/src/nut80.c . ERFA cites the Explanatory
// Supplement to the Astronomical Almanac, P. K. Seidelmann (ed.), 1992, section 3.222 (p111).
// The ERFA licence (BSD 3-clause) asks that this notice be kept with the table:
//
// Copyright (C) 2013-2023, NumFOCUS Foundation.
// All rights reserved.
//
// This library is derived, with permission, from the International
// Astronomical Union's "Standards of Fundamental Astronomy" library,
// available from http://www.iausofa.org.
//
// The ERFA version is intended to retain identical functionality to
// the SOFA library, but made distinct through different function and
// file names, as set out in the SOFA license conditions.  The SOFA
// original has a role as a reference standard for the IAU and IERS,
// and consequently redistribution is permitted only in its unaltered
// state.  The ERFA version is not subject to this restriction and
// therefore can be included in distributions which do not support the
// concept of "read only" software.
//
// Although the intent is to replicate the SOFA API (other than
// replacement of prefix names) and results (with the exception of
// bugs;  any that are discovered will be fixed), SOFA is not
// responsible for any errors found in this version of the library.
//
// If you wish to acknowledge the SOFA heritage, please acknowledge
// that you are using a library derived from SOFA, rather than SOFA
// itself.
//
//
// TERMS AND CONDITIONS
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
//
// 1 Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//
// 2 Redistributions in binary form must reproduce the above copyright
// notice, this list of conditions and the following disclaimer in
// the documentation and/or other materials provided with the
// distribution.
//
// 3 Neither the name of the Standards Of Fundamental Astronomy Board,
// the International Astronomical Union nor the names of its
// contributors may be used to endorse or promote products derived
// from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
// FOR A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE
// COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
// INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
// BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
// LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
// ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
//
//

/** [nl, nlp, nf, nd, nom, sp, spt, ce, cet] for each of the 106 terms. */
export const NUT80: ReadonlyArray<readonly [number, number, number, number, number, number, number, number, number]> = [
  [0, 0, 0, 0, 1, -171996.0, -174.2, 92025.0, 8.9],
  [0, 0, 0, 0, 2, 2062.0, 0.2, -895.0, 0.5],
  [-2, 0, 2, 0, 1, 46.0, 0.0, -24.0, 0.0],
  [2, 0, -2, 0, 0, 11.0, 0.0, 0.0, 0.0],
  [-2, 0, 2, 0, 2, -3.0, 0.0, 1.0, 0.0],
  [1, -1, 0, -1, 0, -3.0, 0.0, 0.0, 0.0],
  [0, -2, 2, -2, 1, -2.0, 0.0, 1.0, 0.0],
  [2, 0, -2, 0, 1, 1.0, 0.0, 0.0, 0.0],
  [0, 0, 2, -2, 2, -13187.0, -1.6, 5736.0, -3.1],
  [0, 1, 0, 0, 0, 1426.0, -3.4, 54.0, -0.1],
  [0, 1, 2, -2, 2, -517.0, 1.2, 224.0, -0.6],
  [0, -1, 2, -2, 2, 217.0, -0.5, -95.0, 0.3],
  [0, 0, 2, -2, 1, 129.0, 0.1, -70.0, 0.0],
  [2, 0, 0, -2, 0, 48.0, 0.0, 1.0, 0.0],
  [0, 0, 2, -2, 0, -22.0, 0.0, 0.0, 0.0],
  [0, 2, 0, 0, 0, 17.0, -0.1, 0.0, 0.0],
  [0, 1, 0, 0, 1, -15.0, 0.0, 9.0, 0.0],
  [0, 2, 2, -2, 2, -16.0, 0.1, 7.0, 0.0],
  [0, -1, 0, 0, 1, -12.0, 0.0, 6.0, 0.0],
  [-2, 0, 0, 2, 1, -6.0, 0.0, 3.0, 0.0],
  [0, -1, 2, -2, 1, -5.0, 0.0, 3.0, 0.0],
  [2, 0, 0, -2, 1, 4.0, 0.0, -2.0, 0.0],
  [0, 1, 2, -2, 1, 4.0, 0.0, -2.0, 0.0],
  [1, 0, 0, -1, 0, -4.0, 0.0, 0.0, 0.0],
  [2, 1, 0, -2, 0, 1.0, 0.0, 0.0, 0.0],
  [0, 0, -2, 2, 1, 1.0, 0.0, 0.0, 0.0],
  [0, 1, -2, 2, 0, -1.0, 0.0, 0.0, 0.0],
  [0, 1, 0, 0, 2, 1.0, 0.0, 0.0, 0.0],
  [-1, 0, 0, 1, 1, 1.0, 0.0, 0.0, 0.0],
  [0, 1, 2, -2, 0, -1.0, 0.0, 0.0, 0.0],
  [0, 0, 2, 0, 2, -2274.0, -0.2, 977.0, -0.5],
  [1, 0, 0, 0, 0, 712.0, 0.1, -7.0, 0.0],
  [0, 0, 2, 0, 1, -386.0, -0.4, 200.0, 0.0],
  [1, 0, 2, 0, 2, -301.0, 0.0, 129.0, -0.1],
  [1, 0, 0, -2, 0, -158.0, 0.0, -1.0, 0.0],
  [-1, 0, 2, 0, 2, 123.0, 0.0, -53.0, 0.0],
  [0, 0, 0, 2, 0, 63.0, 0.0, -2.0, 0.0],
  [1, 0, 0, 0, 1, 63.0, 0.1, -33.0, 0.0],
  [-1, 0, 0, 0, 1, -58.0, -0.1, 32.0, 0.0],
  [-1, 0, 2, 2, 2, -59.0, 0.0, 26.0, 0.0],
  [1, 0, 2, 0, 1, -51.0, 0.0, 27.0, 0.0],
  [0, 0, 2, 2, 2, -38.0, 0.0, 16.0, 0.0],
  [2, 0, 0, 0, 0, 29.0, 0.0, -1.0, 0.0],
  [1, 0, 2, -2, 2, 29.0, 0.0, -12.0, 0.0],
  [2, 0, 2, 0, 2, -31.0, 0.0, 13.0, 0.0],
  [0, 0, 2, 0, 0, 26.0, 0.0, -1.0, 0.0],
  [-1, 0, 2, 0, 1, 21.0, 0.0, -10.0, 0.0],
  [-1, 0, 0, 2, 1, 16.0, 0.0, -8.0, 0.0],
  [1, 0, 0, -2, 1, -13.0, 0.0, 7.0, 0.0],
  [-1, 0, 2, 2, 1, -10.0, 0.0, 5.0, 0.0],
  [1, 1, 0, -2, 0, -7.0, 0.0, 0.0, 0.0],
  [0, 1, 2, 0, 2, 7.0, 0.0, -3.0, 0.0],
  [0, -1, 2, 0, 2, -7.0, 0.0, 3.0, 0.0],
  [1, 0, 2, 2, 2, -8.0, 0.0, 3.0, 0.0],
  [1, 0, 0, 2, 0, 6.0, 0.0, 0.0, 0.0],
  [2, 0, 2, -2, 2, 6.0, 0.0, -3.0, 0.0],
  [0, 0, 0, 2, 1, -6.0, 0.0, 3.0, 0.0],
  [0, 0, 2, 2, 1, -7.0, 0.0, 3.0, 0.0],
  [1, 0, 2, -2, 1, 6.0, 0.0, -3.0, 0.0],
  [0, 0, 0, -2, 1, -5.0, 0.0, 3.0, 0.0],
  [1, -1, 0, 0, 0, 5.0, 0.0, 0.0, 0.0],
  [2, 0, 2, 0, 1, -5.0, 0.0, 3.0, 0.0],
  [0, 1, 0, -2, 0, -4.0, 0.0, 0.0, 0.0],
  [1, 0, -2, 0, 0, 4.0, 0.0, 0.0, 0.0],
  [0, 0, 0, 1, 0, -4.0, 0.0, 0.0, 0.0],
  [1, 1, 0, 0, 0, -3.0, 0.0, 0.0, 0.0],
  [1, 0, 2, 0, 0, 3.0, 0.0, 0.0, 0.0],
  [1, -1, 2, 0, 2, -3.0, 0.0, 1.0, 0.0],
  [-1, -1, 2, 2, 2, -3.0, 0.0, 1.0, 0.0],
  [-2, 0, 0, 0, 1, -2.0, 0.0, 1.0, 0.0],
  [3, 0, 2, 0, 2, -3.0, 0.0, 1.0, 0.0],
  [0, -1, 2, 2, 2, -3.0, 0.0, 1.0, 0.0],
  [1, 1, 2, 0, 2, 2.0, 0.0, -1.0, 0.0],
  [-1, 0, 2, -2, 1, -2.0, 0.0, 1.0, 0.0],
  [2, 0, 0, 0, 1, 2.0, 0.0, -1.0, 0.0],
  [1, 0, 0, 0, 2, -2.0, 0.0, 1.0, 0.0],
  [3, 0, 0, 0, 0, 2.0, 0.0, 0.0, 0.0],
  [0, 0, 2, 1, 2, 2.0, 0.0, -1.0, 0.0],
  [-1, 0, 0, 0, 2, 1.0, 0.0, -1.0, 0.0],
  [1, 0, 0, -4, 0, -1.0, 0.0, 0.0, 0.0],
  [-2, 0, 2, 2, 2, 1.0, 0.0, -1.0, 0.0],
  [-1, 0, 2, 4, 2, -2.0, 0.0, 1.0, 0.0],
  [2, 0, 0, -4, 0, -1.0, 0.0, 0.0, 0.0],
  [1, 1, 2, -2, 2, 1.0, 0.0, -1.0, 0.0],
  [1, 0, 2, 2, 1, -1.0, 0.0, 1.0, 0.0],
  [-2, 0, 2, 4, 2, -1.0, 0.0, 1.0, 0.0],
  [-1, 0, 4, 0, 2, 1.0, 0.0, 0.0, 0.0],
  [1, -1, 0, -2, 0, 1.0, 0.0, 0.0, 0.0],
  [2, 0, 2, -2, 1, 1.0, 0.0, -1.0, 0.0],
  [2, 0, 2, 2, 2, -1.0, 0.0, 0.0, 0.0],
  [1, 0, 0, 2, 1, -1.0, 0.0, 0.0, 0.0],
  [0, 0, 4, -2, 2, 1.0, 0.0, 0.0, 0.0],
  [3, 0, 2, -2, 2, 1.0, 0.0, 0.0, 0.0],
  [1, 0, 2, -2, 0, -1.0, 0.0, 0.0, 0.0],
  [0, 1, 2, 0, 1, 1.0, 0.0, 0.0, 0.0],
  [-1, -1, 0, 2, 1, 1.0, 0.0, 0.0, 0.0],
  [0, 0, -2, 0, 1, -1.0, 0.0, 0.0, 0.0],
  [0, 0, 2, -1, 2, -1.0, 0.0, 0.0, 0.0],
  [0, 1, 0, 2, 0, -1.0, 0.0, 0.0, 0.0],
  [1, 0, -2, -2, 0, -1.0, 0.0, 0.0, 0.0],
  [0, -1, 2, 0, 1, -1.0, 0.0, 0.0, 0.0],
  [1, 1, 0, -2, 1, -1.0, 0.0, 0.0, 0.0],
  [1, 0, -2, 2, 0, -1.0, 0.0, 0.0, 0.0],
  [2, 0, 0, 2, 0, 1.0, 0.0, 0.0, 0.0],
  [0, 0, 2, 4, 2, -1.0, 0.0, 0.0, 0.0],
  [0, 1, 0, 1, 0, 1.0, 0.0, 0.0, 0.0],
];
