//include fs
const fs = require('fs');
var palettes = {};
//go through all txt files in the palettes folder
fs.readdirSync('./palettes').forEach(file => {
    //read the file
    var data = fs.readFileSync(`./palettes/${file}`, 'utf8');
    //strip all \r characters
    data = data.replace(/\r/g, '');
    //split newlines into an array
    data = data.split('\n');
    //remove empty lines
    data = data.filter(line => line.trim() !== '');
    //strip all lines starting with ;
    data = data.filter(line => !line.startsWith(';'));

    //replace first two characters of each element with #
    data = data.map(line => '#' + line.substring(2));
    //strip extension from file
    file = file.replace('.txt', '');
    //add the palette to the palettes object
    palettes[file] = data;
});
console.log(palettes);