A = gallery("fiedler", 25);

iterations = 10000;

# --------------- ADD ---------------------
timeStart = time();
for n = 1:(iterations/10)
  B = A + A;
  B = A + A;
  B = A + A;
  B = A + A;
  B = A + A;
  B = A + A;
  B = A + A;
  B = A + A;
  B = A + A;
  B = A + A;
endfor
timeEnd = time();
duration = timeEnd - timeStart; # seconds
addDuration = duration / iterations * 1e6  # microseconds

# --------------- MULTIPLY ---------------------
timeStart = time();
for n = 1:(iterations/10)
  B = A * A;
  B = A * A;
  B = A * A;
  B = A * A;
  B = A * A;
  B = A * A;
  B = A * A;
  B = A * A;
  B = A * A;
  B = A * A;
endfor
timeEnd = time();
duration = timeEnd - timeStart; # seconds
multiplyDuration = duration / iterations * 1e6  # microseconds

# --------------- TRANSPOSE ---------------------
timeStart = time();
for n = 1:(iterations/10)
  B = A';
  B = A';
  B = A';
  B = A';
  B = A';
  B = A';
  B = A';
  B = A';
  B = A';
  B = A';
endfor
timeEnd = time();
duration = timeEnd - timeStart; # seconds
transposeDuration = duration / iterations * 1e6  # microseconds

# --------------- DETERMINANT ---------------------
timeStart = time();
for n = 1:(iterations/10)
  B = det(A);
  B = det(A);
  B = det(A);
  B = det(A);
  B = det(A);
  B = det(A);
  B = det(A);
  B = det(A);
  B = det(A);
  B = det(A);
endfor
timeEnd = time();
duration = timeEnd - timeStart; # seconds
determinantDuration = duration / iterations * 1e6  # microseconds
