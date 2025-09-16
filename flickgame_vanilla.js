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
    '#3b1c2a', '#6b2c42',
    '#ac3232', '#d95763',
    '#d79b7d', '#f7dba7',
    '#e5e5e5', '#b2cdd6',
    '#8595a1', '#4a6741'
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
    '#000000', '#ffffff',
    '#813338', '#75cec8',
    '#8e3c97', '#56ac4d',
    '#2e2c9b', '#edf171',
    '#8e5029', '#553800',
    '#c46c71', '#4a4a4a',
    '#7b7b7b', '#a9ff9f',
    '#706deb', '#b2b2b2'
  ],
  'color-graphics-adapter': [
    '#000000', '#0000aa',
    '#00aa00', '#00aaaa',
    '#aa0000', '#aa00aa',
    '#aa5500', '#aaaaaa',
    '#555555', '#5555ff',
    '#55ff55', '#55ffff',
    '#ff5555', '#ff55ff',
    '#ffff55', '#ffffff'
  ],
  commodore64: [
    '#000000', '#ffffff',
    '#880000', '#aaffee',
    '#cc44cc', '#00cc55',
    '#0000aa', '#eeee77',
    '#dd8855', '#664400',
    '#ff7777', '#333333',
    '#777777', '#aaff66',
    '#0088ff', '#bbbbbb'
  ],
  'cretaceous-16': [
    '#1e2328', '#493c2b',
    '#a14a76', '#e99f4b',
    '#ed8a5b', '#f2b98a',
    '#f7e7b2', '#c7cfcc',
    '#a7a9ac', '#656c79',
    '#2d2b42', '#1a1c2c',
    '#5d275d', '#b13e53',
    '#ef7d57', '#ffcd75'
  ],
  'darkseed-16': [
    '#222323', '#f0f6f0',
    '#94e344', '#639bff',
    '#8b6f47', '#c4b5fd',
    '#e06f8b', '#ffa8a8',
    '#f4f4f4', '#c0cbdc',
    '#8b956d', '#4a4a4a',
    '#1e1e1e', '#3c3c3c',
    '#8b4513', '#cd853f'
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
    '#1a1c2c', '#5d275d',
    '#b13e53', '#ef7d57',
    '#ffcd75', '#a7f070',
    '#38b764', '#257179',
    '#29366f', '#3b5dc9',
    '#41a6f6', '#73eff7',
    '#f4f4f4', '#94b0c2',
    '#566c86', '#333c57'
  ],
  'endesga-16': [
    '#be4a2f', '#d77643',
    '#ead4aa', '#e4a672',
    '#b86f50', '#733e39',
    '#3e2731', '#a22633',
    '#e43b44', '#f77622',
    '#feae34', '#fee761',
    '#63c74d', '#3e8948',
    '#265c42', '#193c3e'
  ],
  'eroge-copper': [
    '#0d080d', '#4a2545',
    '#8b4a47', '#c27d46',
    '#e2b947', '#f5f3c1',
    '#dae0ea', '#a8b5c4',
    '#6d758d', '#494d5c',
    '#2e2a2e', '#68386c',
    '#b55088', '#f0a6a0',
    '#f4d29c', '#dae0ea'
  ],
  'fading-16': [
    '#100b0d', '#1a1a1a',
    '#2e2e2e', '#4a4a4a',
    '#6b6b6b', '#8d8d8d',
    '#adadad', '#c4c4c4',
    '#d9d9d9', '#ebebeb',
    '#f7f7f7', '#ffffff',
    '#e8e8e8', '#d0d0d0',
    '#b8b8b8', '#9e9e9e'
  ],
  'galaxy-flame': [
    '#0b0b0b', '#1a1a1a',
    '#2e2e2e', '#4a4a4a',
    '#6b6b6b', '#8d8d8d',
    '#adadad', '#c4c4c4',
    '#d9d9d9', '#ebebeb',
    '#f7f7f7', '#ffffff',
    '#e8e8e8', '#d0d0d0',
    '#b8b8b8', '#9e9e9e'
  ],
  'go-line': [
    '#0b0b0b', '#1a1a1a',
    '#2e2e2e', '#4a4a4a',
    '#6b6b6b', '#8d8d8d',
    '#adadad', '#c4c4c4',
    '#d9d9d9', '#ebebeb',
    '#f7f7f7', '#ffffff',
    '#e8e8e8', '#d0d0d0',
    '#b8b8b8', '#9e9e9e'
  ],
  'grayscale-16': [
    '#000000', '#111111',
    '#222222', '#333333',
    '#444444', '#555555',
    '#666666', '#777777',
    '#888888', '#999999',
    '#aaaaaa', '#bbbbbb',
    '#cccccc', '#dddddd',
    '#eeeeee', '#ffffff'
  ],
  'island-joy-16': [
    '#14193f', '#26234a',
    '#4a3c57', '#68386c',
    '#b55088', '#f0a6a0',
    '#f4d29c', '#dae0ea',
    '#a8b5c4', '#6d758d',
    '#494d5c', '#2e2a2e',
    '#68386c', '#b55088',
    '#f0a6a0', '#f4d29c'
  ],
  'lost-century': [
    '#2c1e31', '#6a4c93',
    '#a663cc', '#e0aaff',
    '#c77dff', '#9d4edd',
    '#7209b7', '#560bad',
    '#480ca8', '#3a0ca3',
    '#3f37c9', '#4361ee',
    '#4895ef', '#4cc9f0',
    '#7209b7', '#560bad'
  ],
  'microsoft-windows': [
    '#000000', '#800000',
    '#008000', '#808000',
    '#000080', '#800080',
    '#008080', '#c0c0c0',
    '#808080', '#ff0000',
    '#00ff00', '#ffff00',
    '#0000ff', '#ff00ff',
    '#00ffff', '#ffffff'
  ],
  'miyazaki-16': [
    '#1a1c2c', '#5d275d',
    '#b13e53', '#ef7d57',
    '#ffcd75', '#a7f070',
    '#38b764', '#257179',
    '#29366f', '#3b5dc9',
    '#41a6f6', '#73eff7',
    '#f4f4f4', '#94b0c2',
    '#566c86', '#333c57'
  ],
  na16: [
    '#140c1c', '#442434',
    '#30346d', '#4e4a4e',
    '#854c30', '#346524',
    '#d04648', '#757161',
    '#597dce', '#d27d2c',
    '#8595a1', '#6daa2c',
    '#d2aa99', '#6dc2ca',
    '#dad45e', '#deeed6'
  ],
  'nanner-jam': [
    '#140c1c', '#442434',
    '#30346d', '#4e4a4e',
    '#854c30', '#346524',
    '#d04648', '#757161',
    '#597dce', '#d27d2c',
    '#8595a1', '#6daa2c',
    '#d2aa99', '#6dc2ca',
    '#dad45e', '#deeed6'
  ],
  'pico-8': [
    '#000000', '#1d2b53',
    '#7e2553', '#008751',
    '#ab5236', '#5f574f',
    '#c2c3c7', '#fff1e8',
    '#ff004d', '#ffa300',
    '#ffec27', '#00e436',
    '#29adff', '#83769c',
    '#ff77a8', '#ffccaa'
  ],
  'r-place': [
    '#000000', '#898d90',
    '#d4d7d9', '#ffffff',
    '#6d001a', '#be0039',
    '#ff4500', '#ffa800',
    '#ffd635', '#00a368',
    '#00cc78', '#7eed56',
    '#00756f', '#009eaa',
    '#2450a4', '#3690ea'
  ],
  'shido-cyberneon': [
    '#0f0f23', '#2b2b52',
    '#5b5b8d', '#8b8bc7',
    '#ababf5', '#c7c7ff',
    '#e3e3ff', '#f5f5ff',
    '#ff8b8b', '#ffab8b',
    '#ffcb8b', '#ffeb8b',
    '#cbff8b', '#8bff8b',
    '#8bffab', '#8bffcb'
  ],
  'steam-lords': [
    '#140c1c', '#442434',
    '#30346d', '#4e4a4e',
    '#854c30', '#346524',
    '#d04648', '#757161',
    '#597dce', '#d27d2c',
    '#8595a1', '#6daa2c',
    '#d2aa99', '#6dc2ca',
    '#dad45e', '#deeed6'
  ],
  'summers-past-16': [
    '#140c1c', '#442434',
    '#30346d', '#4e4a4e',
    '#854c30', '#346524',
    '#d04648', '#757161',
    '#597dce', '#d27d2c',
    '#8595a1', '#6daa2c',
    '#d2aa99', '#6dc2ca',
    '#dad45e', '#deeed6'
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
    '#140c1c', '#442434',
    '#30346d', '#4e4a4e',
    '#854c30', '#346524',
    '#d04648', '#757161',
    '#597dce', '#d27d2c',
    '#8595a1', '#6daa2c',
    '#d2aa99', '#6dc2ca',
    '#dad45e', '#deeed6'
  ],
  'urbex-16': [
    '#140c1c', '#442434',
    '#30346d', '#4e4a4e',
    '#854c30', '#346524',
    '#d04648', '#757161',
    '#597dce', '#d27d2c',
    '#8595a1', '#6daa2c',
    '#d2aa99', '#6dc2ca',
    '#dad45e', '#deeed6'
  ],
  'vanilla-milkshake': [
    '#140c1c', '#442434',
    '#30346d', '#4e4a4e',
    '#854c30', '#346524',
    '#d04648', '#757161',
    '#597dce', '#d27d2c',
    '#8595a1', '#6daa2c',
    '#d2aa99', '#6dc2ca',
    '#dad45e', '#deeed6'
  ],
  woodspark: [
    '#140c1c', '#442434',
    '#30346d', '#4e4a4e',
    '#854c30', '#346524',
    '#d04648', '#757161',
    '#597dce', '#d27d2c',
    '#8595a1', '#6daa2c',
    '#d2aa99', '#6dc2ca',
    '#dad45e', '#deeed6'
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