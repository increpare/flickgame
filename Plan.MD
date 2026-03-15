SCOPE: THIS ONLY APPLIES TO index.html/play.html - that's all we care about right now.

Right now we have a split interface - you can select what colour you're going to draw with by clicking on that colours buttons. Underneath each colour is a dropdown where you can say what it should hyperlink to.  

Better would be to unify both of these - instead of a list of palette colour swatches over a list of dropdowns, we have a single list of palette colour swatches, where you can see overlaid what the linked target page is (if any). Tap on an unselected colour swatch to select that colour for painting. If you tap on an already-selected colour, it brings up the dropdown to assign/clear a link to that colour for your page.


STEPS: 1 adjust existing interface to be more compatible with the intended mobile usage


DONE 1.a : unify colour picker and link selection dropdown

Right now we have a split interface - you can select what colour you're going to draw with by clicking on that colours buttons. Underneath each colour is a dropdown where you can say what it should hyperlink to.  

Better would be to unify both of these - instead of a list of palette colour swatches over a list of dropdowns, we have a single list of palette colour swatches, where you can see overlaid what the linked target page is (if any). Tap on an unselected colour swatch to select that colour for painting. If you tap on an already-selected colour, it brings up the dropdown to assign/clear a link to that colour for your page.

DONE 1.b : implement a 'pointer' mode for the editor. When you click on this button, you're not longer editing the game, but testing out links. This ideally should share javascript code with play.html - be careful that on touchscreens that we have the 'drag cursor' mode enabled.

1.C : brush-size selection - change from a series of buttons to a slider (vertical by default, but I want the option to have a horizontal slider also, because when we get to mobile it will be horizontal).  This is a 'size indication' slider.  The dot that you're dragging along the slider should have the same size as your brush size! (give it a black border if it's too small) .The background, instead of a single horizontal line, should be narrow at the bottom(/left respectively) where the brush size is small, and big on the top side(/right)

DONE 1.D  IDEA: in the dropdown for selecting links for colours, show a thunbmail for the image you're linking to to the left of its index. Is this even possible? IIRC dropdowns are very restricted in terms of how you can style them.

DONE 1.E save state to localstorage and automatically load it if it exists when you load a page. Add a 'new flickgame' button to the right of the paste button (use 'new_flickgame.png' as the icon)

DONE STEP 2: figure out a good structure for having two parallel interfaces depending on whether on mobile(touchscreen/portrait) or desktop.

DONE 2.a we need to figure out an elegant way to have two different interface setups.  The two layouts are *very* different. Some tools from the desktop version need to be reorganised and put into a burger menu dialog thing, because we don't have space.

DONE 2.b he desktop version has a very elegant and simple list of frames that you use to browse frames, that displays thumbnails.  For mobile I don't know what to do. Let's try the following for when we are on mobile with a portrait layout. We do not show the user the <ul> of layers. Instead we have a dropdown menu called 'FRAME' that opens up a frame selection menu (Can share lots of code with the dropdown menu for colour swatch link targets!).

DONE 2.d So, to decribe the new interface in detail: 

top row, toolbar: [FRAME (opens frame selection dropdown) ] [ DOWNLOAD (downloads html files )] [ burger menu (opens dialog with rarer options]

then: [canvas]

then toolbar: [horizontal brush size slide] [ bucket tool ] [ undo button ] [ pointer mode button]

then: the dropdown menu for colour swatch link targets, but instead of being 16 dropdowns in a row, it's a 4x4 grid.


===the burger menu brings up a modal dialogue box with the following options:===
url link (text input), share, export, import, help, select colour palette (another dropdown), copy (current layer), paste (current layer), clear page

2.e So, normally we have 160x120 canvas size. IN mobile we have 160 width and we pick the height so that it takes up as much screen space as possible.  HOWEVER if we're loading an existing file (or randomly change device while editing) we do *not* resize the canvas to the new size, but scale the on-screen canvas proportionally to fit as well as we can.