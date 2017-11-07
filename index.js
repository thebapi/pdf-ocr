/**
 * Created by sajibsarkar on 6/21/17.
 */

'use strict';

const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const async = require('async');
const OCRService = require('./server/services/OCRService');

//'3.11.2.2.2 Wickfield Center 2015 Historical NOI';
//6.10.3.1.5 483-P&L -2015,2014,2013.pdf
//LLWinter_2016_17_unsec.pdf
//12 Month Operating Statement.pdf


let files = fs.readdirSync(path.join(__dirname , 'samples'), 'utf8');

files = files.filter(file=> path.extname(file).toLowerCase() === '.pdf');

console.log('files', files);



let filePaths = files.map(file=>  path.join(__dirname , 'samples', file));

filePaths.map(file=> {
    OCRService.parsePdfFile(file).then(function (parsedText) {
        console.log('parsedText...', parsedText);
    }).catch((err) => {
        console.log('err', err);
    });
});

/*filePaths.map(file=> {
    OCRService.parsePdfFileInfo(file).then(function (pdfInfo) {
        console.log('parsed Pdf Info...', pdfInfo);
    }).catch((err) => {
        console.log('err', err);
    });
});*/







debugger;
/*OCRService.parsePdfFileAsJSON(filePath).then(function (parsedText) {
   // console.log('parsedText...', parsedText);
}).catch((err) => {
    console.log('err', err);
});*/
