/*
Hello, World! example
June 11, 2015
Copyright (C) 2015 David Martinez
All rights reserved.
This code is the most basic barebones code for writing a program for Arduboy.

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.
*/

#include <Arduboy2.h>

Arduboy2 arduboy;

void setup() {
  arduboy.boot();
  arduboy.setFrameRate(15);
  render();
}


void render(){
  arduboy.fillScreen(1);

  arduboy.fillRect(0,64-8,128,8,0);
  const char* s = "< Hgq*_`1 >";
  byte l = strlen(s);
  int xoffset = 128/2-l*6/2;
  arduboy.setCursor(xoffset,64-7);
  arduboy.setTextColor(1);
  arduboy.setTextBackground(0);
  arduboy.print(s);
  arduboy.display();
}
