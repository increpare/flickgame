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
