// Flick Game JavaScript Library
// Extracted shared functions from HTML files

// Global variables
var gameState;

// Helper function to get URL parameters
function getParameterByName(name) {
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// Helper function to strip http/https from URLs
function strip_http(url) {
   url = url.replace(/^https?:\/\//,'');
   return url;
}

// Helper function to qualify URLs
function qualifyURL(url) {
    var aurl = document.createElement('a');
    aurl.href = url;
    return aurl.href;
}

// Color math utilities

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 0, g: 0, b: 0 };
}

function rgbToLab(r,g,b) {
    r /= 255; g /= 255; b /= 255;
    r = (r > 0.04045) ? (((r + 0.055) / 1.055) ** 2.4) : r / 12.92;
    g = (g > 0.04045) ? (((g + 0.055) / 1.055) ** 2.4) : g / 12.92;
    b = (b > 0.04045) ? (((b + 0.055) / 1.055) ** 2.4) : b / 12.92;
    var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    var y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    var z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    x = (x > 0.008856) ? (x ** (1 / 3)) : (7.787 * x) + 16 / 116;
    y = (y > 0.008856) ? (y ** (1 / 3)) : (7.787 * y) + 16 / 116;
    z = (z > 0.008856) ? (z ** (1 / 3)) : (7.787 * z) + 16 / 116;
    return { L: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function color_distance(color1, color2) {
    var c1 = hexToRgb(color1);
    var c2 = hexToRgb(color2);
    var lab1 = rgbToLab(c1.r, c1.g, c1.b);
    var lab2 = rgbToLab(c2.r, c2.g, c2.b);
    var dL = lab1.L - lab2.L, dA = lab1.a - lab2.a, dB = lab1.b - lab2.b;
    return Math.sqrt(dL * dL + dA * dA + dB * dB);
}

function nearest_color_index_in_palette(palette, target_color) {
    var nearest_idx = 0;
    var nearest_dist = color_distance(target_color, palette[0]);
    for (var i = 1; i < palette.length; i++) {
        var dist = color_distance(target_color, palette[i]);
        if (dist < nearest_dist) { nearest_dist = dist; nearest_idx = i; }
    }
    return nearest_idx;
}

function nearest_color_in_palette(palette, target_color) {
    return palette[nearest_color_index_in_palette(palette, target_color)];
}

// Returns "#ffffff" or "#000000" for best contrast against the given hex color
function contrastTextColor(hex) {
    var dw = color_distance(hex, "#ffffff");
    var db = color_distance(hex, "#000000");
    return dw > db ? "#ffffff" : "#000000";
}

// RLE decode function
function RLE_decode(encoded) {
    var output = "";
    for (var i=0;i<encoded.length;i+=2) {
      var count = encoded[i];
      var ch = encoded[i+1];
      for (var j=0;j<count;j++){
        output+=ch;
      }
    }
    return output;
}



// Generic getData function that can be used by both player and editor
function getData(options) {
    options = options || {};
    var onSuccess = options.onSuccess || function(code) {};
    var onError = options.onError || console.log;
    var onEmbedded = options.onEmbedded || function(code) {};

    // Handle embedded data
    if (typeof embeddedDat !== 'undefined' && embeddedDat[0] !== '_') {
        embeddedDat = decodeURI(embeddedDat);
        onEmbedded(embeddedDat);
        return true;
    }

    // Get ID from URL parameter
    var id = getParameterByName("p").replace(/[\\\/]/, "");
    if (id === null || id.length === 0) {
        // onError("No ID specified in URL.");
        return false;
    }

    // Choose URL based on whether to use proxy
    var url = "https://ded.increpare.com/cgi-bin/gist_proxy.py?id=" + id;
    
    // this instead to use the GitHub API directly (which is broken because of https://github.com/increpare/flickgame/issues/77 )
    // url = 'https://api.github.com/gists/' + id;
    
    var httpClient = new XMLHttpRequest();
    httpClient.open('GET', url);
    httpClient.onreadystatechange = function() {
        if (httpClient.readyState != 4) {
            return;
        }

        var code;        
        
        // Handle proxy response
        if (httpClient.status === 200) {
            try {
                var response = JSON.parse(httpClient.responseText);
                if (response.error) {
                    onError("Proxy error: " + response.error);
                    return;
                } else if (response.content) {
                    code = response.content;
                } else {
                    onError("Invalid proxy response");
                    return;
                }
            } catch (e) {
                onError("Failed to parse proxy response");
                return;
            }
        } else {
            onError("Proxy request failed with status " + httpClient.status);
            return;
        }
    

        // Call success callback with the loaded code
        onSuccess(code);
    }
    
    httpClient.send();
    return true;
}
