// Color palettes
var palettes = {
  antiquity16: [
    '#202020', '#2d211e',
    '#452923', '#6d3d29',
    '#b16b4a', '#e89f6e',
    '#e8be82', '#5d7557',
    '#8e9257', '#707b88',
    '#8aa7ac', '#e55d4d',
    '#f1866c', '#d26730',
    '#de9a28', '#e8d8a5'
],
arq16: [
    '#ffffff', '#ffd19d',
    '#aeb5bd', '#4d80c9',
    '#e93841', '#100820',
    '#511e43', '#054494',
    '#f1892d', '#823e2c',
    '#ffa9a9', '#5ae150',
    '#ffe947', '#7d3ebf',
    '#eb6c82', '#1e8a4c'
],
'bubblegum-16': [
    '#16171a', '#7f0622',
    '#d62411', '#ff8426',
    '#ffd100', '#fafdff',
    '#ff80a4', '#ff2674',
    '#94216a', '#430067',
    '#234975', '#68aed4',
    '#bfff3c', '#10d275',
    '#007899', '#002859'
],
colodore: [
    '#000000', '#4a4a4a',
    '#7b7b7b', '#b2b2b2',
    '#ffffff', '#813338',
    '#c46c71', '#553800',
    '#8e5029', '#edf171',
    '#a9ff9f', '#56ac4d',
    '#75cec8', '#706deb',
    '#2e2c9b', '#8e3c97'
],
'color-graphics-adapter': [
    '#000000', '#555555',
    '#aaaaaa', '#ffffff',
    '#0000aa', '#5555ff',
    '#00aa00', '#55ff55',
    '#00aaaa', '#55ffff',
    '#aa0000', '#ff5555',
    '#aa00aa', '#ff55ff',
    '#aa5500', '#ffff55'
],
commodore64: [
    '#000000', '#626262',
    '#898989', '#adadad',
    '#ffffff', '#9f4e44',
    '#cb7e75', '#6d5412',
    '#a1683c', '#c9d487',
    '#9ae29b', '#5cab5e',
    '#6abfc6', '#887ecb',
    '#50459b', '#a057a3'
],
'cretaceous-16': [
    '#313432', '#323e42',
    '#454b4b', '#3a5f3b',
    '#7c4545', '#675239',
    '#625055', '#516b43',
    '#796c64', '#718245',
    '#9e805c', '#998579',
    '#ac9086', '#a6a296',
    '#b4ab8f', '#bcb7a5'
],
'darkseed-16': [
    '#000000', '#001418',
    '#002024', '#002c38',
    '#143444', '#443444',
    '#583c48', '#6c4c44',
    '#806058', '#6c706c',
    '#888078', '#a49484',
    '#c4ac9c', '#d8b0a8',
    '#ecd4d0', '#fcfcfc'
],
'dawnbringer-16': [
    '#140c1c', '#442434',
    '#30346d', '#4e4a4e',
    '#854c30', '#346524',
    '#d04648', '#757161',
    '#597dce', '#d27d2c',
    '#8595a1', '#6daa2c',
    '#d2aa99', '#6dc2ca',
    '#dad45e', '#deeed6'
],
'daylight-16': [
    '#f2d3ac', '#e7a76c',
    '#c28462', '#905b54',
    '#513a3d', '#7a6977',
    '#878c87', '#b5c69a',
    '#272223', '#606b31',
    '#b19e3f', '#f8c65c',
    '#d58b39', '#996336',
    '#6a422c', '#b55b39'
],
'endesga-16': [
    '#e4a672', '#b86f50',
    '#743f39', '#3f2832',
    '#9e2835', '#e53b44',
    '#fb922b', '#ffe762',
    '#63c64d', '#327345',
    '#193d3f', '#4f6781',
    '#afbfd2', '#ffffff',
    '#2ce8f4', '#0484d1'
],
'eroge-copper': [
    '#0d080d', '#4f2b24',
    '#825b31', '#c59154',
    '#f0bd77', '#fbdf9b',
    '#fff9e4', '#bebbb2',
    '#7bb24e', '#74adbb',
    '#4180a0', '#32535f',
    '#2a2349', '#7d3840',
    '#c16c5b', '#e89973'
],
'fading-16': [
    '#ddcf99', '#cca87b',
    '#b97a60', '#9c524e',
    '#774251', '#4b3d44',
    '#4e5463', '#5b7d73',
    '#8e9f7d', '#645355',
    '#8c7c79', '#a99c8d',
    '#7d7b62', '#aaa25d',
    '#846d59', '#a88a5e'
],
'galaxy-flame': [
    '#699fad', '#3a708e',
    '#2b454f', '#111215',
    '#151d1a', '#1d3230',
    '#314e3f', '#4f5d42',
    '#9a9f87', '#ede6cb',
    '#f5d893', '#e8b26f',
    '#b6834c', '#704d2b',
    '#40231e', '#151015'
],
'go-line': [
    '#430067', '#94216a',
    '#ff004d', '#ff8426',
    '#ffdd34', '#50e112',
    '#3fa66f', '#365987',
    '#000000', '#0033ff',
    '#29adff', '#00ffcc',
    '#fff1e8', '#c2c3c7',
    '#ab5236', '#5f574f'
],
'grayscale-16': [
    '#000000', '#181818',
    '#282828', '#383838',
    '#474747', '#565656',
    '#646464', '#717171',
    '#7e7e7e', '#8c8c8c',
    '#9b9b9b', '#ababab',
    '#bdbdbd', '#d1d1d1',
    '#e7e7e7', '#ffffff'
],
'island-joy-16': [
    '#ffffff', '#6df7c1',
    '#11adc1', '#606c81',
    '#393457', '#1e8875',
    '#5bb361', '#a1e55a',
    '#f7e476', '#f99252',
    '#cb4d68', '#6a3771',
    '#c92464', '#f48cb6',
    '#f7b69e', '#9b9c82'
],
'lost-century': [
    '#d1b187', '#c77b58',
    '#ae5d40', '#79444a',
    '#4b3d44', '#ba9158',
    '#927441', '#4d4539',
    '#77743b', '#b3a555',
    '#d2c9a5', '#8caba1',
    '#4b726e', '#574852',
    '#847875', '#ab9b8e'
],
'microsoft-windows': [
    '#000000', '#7e7e7e',
    '#bebebe', '#ffffff',
    '#7e0000', '#fe0000',
    '#047e00', '#06ff04',
    '#7e7e00', '#ffff04',
    '#00007e', '#0000ff',
    '#7e007e', '#fe00ff',
    '#047e7e', '#06ffff'
],
'miyazaki-16': [
    '#232228', '#284261',
    '#5f5854', '#878573',
    '#b8b095', '#c3d5c7',
    '#ebecdc', '#2485a6',
    '#54bad2', '#754d45',
    '#c65046', '#e6928a',
    '#1e7453', '#55a058',
    '#a1bf41', '#e3c054'
],
na16: [
    '#8c8fae', '#584563',
    '#3e2137', '#9a6348',
    '#d79b7d', '#f5edba',
    '#c0c741', '#647d34',
    '#e4943a', '#9d303b',
    '#d26471', '#70377f',
    '#7ec4c1', '#34859d',
    '#17434b', '#1f0e1c'
],
'nanner-jam': [
    '#352b40', '#653d48',
    '#933f45', '#b25e46',
    '#cc925e', '#dacb80',
    '#f0e9c9', '#76c379',
    '#508d76', '#535c89',
    '#7b99c8', '#99d4e6',
    '#be7979', '#d8b1a1',
    '#7d6e6e', '#c2b5a9'
],
'pico-8': [
    '#000000', '#1D2B53',
    '#7E2553', '#008751',
    '#AB5236', '#5F574F',
    '#C2C3C7', '#FFF1E8',
    '#FF004D', '#FFA300',
    '#FFEC27', '#00E436',
    '#29ADFF', '#83769C',
    '#FF77A8', '#FFCCAA'
],
'r-place': [
    '#FFFFFF', '#E4E4E4',
    '#888888', '#222222',
    '#FFA7D1', '#E50000',
    '#E59500', '#A06A42',
    '#E5D900', '#94E044',
    '#02BE01', '#00D3DD',
    '#0083C7', '#0000EA',
    '#CF6EE4', '#820080'
],
'shido-cyberneon': [
    '#00033c', '#005260',
    '#009d4a', '#0aff52',
    '#003884', '#008ac5',
    '#00f7ff', '#ff5cff',
    '#ac29ce', '#600088',
    '#b10585', '#ff004e',
    '#2a2e79', '#4e6ea8',
    '#add4fa', '#ffffff'
],
'steam-lords': [
    '#213b25', '#3a604a',
    '#4f7754', '#a19f7c',
    '#77744f', '#775c4f',
    '#603b3a', '#3b2137',
    '#170e19', '#2f213b',
    '#433a60', '#4f5277',
    '#65738c', '#7c94a1',
    '#a0b9ba', '#c0d1cc'
],
'summers-past-16': [
    '#320011', '#5f3a60',
    '#876672', '#b7a39d',
    '#ece8c2', '#6db7c3',
    '#5e80b2', '#627057',
    '#8da24e', '#d2cb3e',
    '#f7d554', '#e8bf92',
    '#e78c5b', '#c66f5e',
    '#c33846', '#933942'
],
'sweetie-16': [
    '#1a1c2c', '#5d275d',
    '#b13e53', '#ef7d57',
    '#ffcd75', '#a7f070',
    '#38b764', '#257179',
    '#29366f', '#3b5dc9',
    '#41a6f6', '#73eff7',
    '#f4f4f4', '#94b0c2',
    '#566c86', '#333c57'
],
'taffy-16': [
    '#222533', '#6275ba',
    '#a3c0e6', '#fafffc',
    '#ffab7b', '#ff6c7a',
    '#dc435b', '#3f48c2',
    '#448de7', '#2bdb72',
    '#a7f547', '#ffeb33',
    '#f58931', '#db4b3d',
    '#a63d57', '#36354d'
],
'urbex-16': [
    '#cbd1be', '#8f9389',
    '#52534c', '#26201d',
    '#e0a46e', '#91a47a',
    '#5d7643', '#4d533a',
    '#a93130', '#7a1338',
    '#834664', '#917692',
    '#160712', '#593084',
    '#3870be', '#579fb4'
],
'vanilla-milkshake': [
    '#28282e', '#6c5671',
    '#d9c8bf', '#f98284',
    '#b0a9e4', '#accce4',
    '#b3e3da', '#feaae4',
    '#87a889', '#b0eb93',
    '#e9f59d', '#ffe6c6',
    '#dea38b', '#ffc384',
    '#fff7a0', '#fff7e4'
],
woodspark: [
    '#f5eeb0', '#fabf61',
    '#e08d51', '#8a5865',
    '#452b3f', '#2c5e3b',
    '#609c4f', '#c6cc54',
    '#78c2d6', '#5479b0',
    '#56546e', '#839fa6',
    '#e0d3c8', '#f05b5b',
    '#8f325f', '#eb6c98'
]
};

// Load state function
function loadState(code) {
  gameState = JSON.parse(code);
  if (gameState.palette_name === undefined) {
      console.log("palette_name not defined, setting to dawnbringer-16");
      gameState.palette_name = "dawnbringer-16";
  }
  if (gameState.background_color === undefined) {
      console.log("background_color not defined, setting to #000000");
      gameState.background_color = "#000000";
  }
  if (gameState.foreground_color === undefined) {
      console.log("foreground_color not defined, setting to #ffffff");
      gameState.foreground_color = "#ffffff";
  }
  colorPalette = palettes[gameState.palette_name];

  // Set background color
  document.documentElement.style.setProperty('--background-color', gameState.background_color);
  document.documentElement.style.setProperty('--foreground-color', gameState.foreground_color);

  // Pad hyperlinks array if it's shorter than canvasses array
  // This handles the case where a regular flickgame (16 pages) is imported into flickgame_big (128 pages)
  // Also fixes corrupted files where some entries might be null
  if (gameState.hyperlinks && gameState.canvasses) {
    var expectedLength = gameState.canvasses.length;
    for (var i = 0; i < expectedLength; i++) {
      if (!gameState.hyperlinks[i] || !Array.isArray(gameState.hyperlinks[i])) {
        gameState.hyperlinks[i] = new Array(16).fill(0);
      }
    }
  }

  var homepage = gameState.gameLink;
  var homepageLink = document.getElementById("homeLink");
  if (homepageLink) {
      homepageLink.innerHTML = strip_http(homepage);
      if (!homepage.match(/^https?:\/\//)) {
          homepage = "http://" + homepage;
      }
      homepageLink.href = homepage;
  }
}


    
function upgrade_v1_to_v2(state){
    //OK THERE'S NO GOOD SOLUTION TO THIS, I'M GOING TO DO NUFINK

    //https://github.com/increpare/flickgame/issues/82
    //if version not defined, then I need to do the pallette_fix

    //imperfect fix, but what am i gonna do...
    //go through all the old palettes and find what new palletes they're assigned to (i.e. 
    //every colour in the old palette should have a new colour in the new palette)
    // var assignments = {};
    // for (var paletteName in palettes_old){
    //     var old_palette = palettes_old[paletteName];
    //     var all_colors_found = true;
    //     for (var i = 0; i < old_palette.length; i++){
    //         var color = old_palette[i];
    //         assignments[color] = paletteName;
    //         var found_match = false;
    //         for (var j = 0; j < palettes[paletteName].length; j++){
    //             var new_color = palettes[paletteName][j];
    //             if (color_distance(color, new_color) < 10){
    //                 found_match = true;
    //                 break;
    //             }
    //         }
    //         if (!found_match){
    //             console.error("No matching color found for " + color + " in " + paletteName);
    //             all_colors_found = false;
    //         }
    //     }
    //     if (all_colors_found){
    //         assignments[paletteName] = paletteName;
    //     } else {
    //         console.error("Not all colors found for " + paletteName);
    //     }
    // }

    // var old_palette_name = state.palette_name;
    // state.palette_name = assignments[old_palette_name];

    // //now we need to fix the colours by converting the old palettes (palettes_old) to the new palettes (palettes)
    // var new_palette_name = state.palette_name;

    // var conversion_map = {};//conversion_map[old_color_index] = new_color_index;


    // var old_palette = palettes_old[old_palette_name];
    // var new_palette = palettes[new_palette_name];
    // for (var i = 0; i < old_palette.length; i++){
    //     var color = old_palette[i];
    //     var matching_color_idx=-1
    //     for (var j = 0; j < new_palette.length; j++){
    //     var new_color = new_palette[j];
    //     if (color_distance(color, new_color) < 10){
    //         matching_color_idx = j;
    //         break;
    //     }
    //     }
    //     conversion_map[i] = matching_color_idx;
    //     if (matching_color_idx === -1){
    //     console.error("No matching color found for " + color + " in " + new_palette_name);
    //     }
    // }

    // //now we need to go through each frame and convert the colours using the conversion_map
    // for (var i = 0; i < state.canvasses.length; i++){
    //     var frame = state.canvasses[i];
    //     for (var j = 0; j < frame.length; j++){
    //     var color = frame[j];
    //     frame[j] = conversion_map[color];
    //     }
    // }



    state.version = "2";
    return state;      
}
