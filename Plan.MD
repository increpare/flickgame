Right now we have a split interface - you can select what colour you're going to draw with by clicking on that colours buttons. Underneath each colour is a dropdown where you can say what it should hyperlink to.  

Better would be to unify both of these - instead of a list of palette colour swatches over a list of dropdowns, we have a single list of palette colour swatches, where you can see overlaid what the linked target page is (if any). Tap on an unselected colour swatch to select that colour for painting. If you tap on an already-selected colour, it brings up the dropdown to assign/clear a link to that colour for your page.


STEPS: 1 adjust existing interface to be more compatible with the intended mobile usage


1.a : unify colour picker and link selection dropdown

Right now we have a split interface - you can select what colour you're going to draw with by clicking on that colours buttons. Underneath each colour is a dropdown where you can say what it should hyperlink to.  

Better would be to unify both of these - instead of a list of palette colour swatches over a list of dropdowns, we have a single list of palette colour swatches, where you can see overlaid what the linked target page is (if any). Tap on an unselected colour swatch to select that colour for painting. If you tap on an already-selected colour, it brings up the dropdown to assign/clear a link to that colour for your page.

1.b : implement a 'pointer' mode for the editor. When you click on this button, you're not longer editing the game, but testing out links. This ideally should share javascript code with play.html - be careful that on touchscreens that we have the 'drag cursor' mode enabled.

1.C : brush-size selection - change from a series of buttons to a slider (vertical by default, but I want the option to have a horizontal slider also).  This is a 'size indication' slider.  The dot that you're dragging along the slider should have the same size as your brush size! (give it a black border if it's too small) .The background, instead of a single horizontal line, should be narrow at the bottom(/left respectively) where the brush size is small, and big on the top side(/right)

1.D  IDEA: in the dropdown for selecting links for colours, show a thunbmail for the image you're linking to to the left of its index. Is this even possible? IIRC dropdowns are very restricted in terms of how you can style them.

1.E save state to localstorage and automatically load it. Add a 'new flickgame' button to the right of the paste button (use 'new_flickgame.png' as the icon)

STEP 2: figure out a good structure for having two parallel interfaces depending on whether on mobile(touchscreen/portrait) or desktop.

2.a we need to figure out an elegant way to have two different interface setups.  The two layouts are *very* different. Some tools from the desktop version need to be reorganised and put into a burger menu dialog thing, because we don't have space.

2.b The desktop version has a very elegant and simple list of frames that you use to browse frames, that displays thumbnails.  For mobile I don't know what to do. We don't have the space to show 16 numbered thumbnails.  The best approach might be a pop-out radial menu, or just  [left arrow button ] [current page number] [right arrow button], but a downside to that is you can't easiyl see what page you are linking to. 

2.c I think mobile just needs a square aspect-ratio. So instead of 160x100,we want 128x128 for mobile. I think this means we need to decide what happens when we import games with different resolutions.  The most flexible approach would be to secretly support both resolutions for both platforms. But on mobile you're defaulting to 128x128, and in desktop you're defaulting to 160x100. However, if you import/edit a file made with the other aspect ratio, it just scales to fit the bounding box of what's usually allocated to the canvas. (Hopefully without terribly increasing the complexity of everything lol).
