/**
 * Created by sajibsarkar on 6/21/17.
 */
'use strict';

const _         = require('lodash');
const s         = require("underscore.string");
const fs        = require('fs');
const inspect   = require('eyes').inspector({maxLength:20000});
const pdf_extract = require('../lib/pdf-extract/main');
const PDFParser = require("pdf2json");
const jsonfile  = require('jsonfile');
const path      = require('path');
const pdfUtil   = require('pdf-to-text');
const async     = require('async');
const fse       = require('fs-extra');
const Tesseract = require('tesseract.js');
const cheerio   = require('cheerio');
const stripAnsi = require('strip-ansi');
_.mixin(s.exports());
const textExtract = require('../lib/pdf-text-extract/main');
const reAstral = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

module.exports.parsePdfFile  = function (filePath) {

    return new Promise((resolve, reject) => {
        console.log('filePath', filePath);

            let options = {
                cwd: "./",
                type: 'ocr',  // extract the actual text in the pdf file
                clean: false, // keep the single page pdfs created during the ocr process
                ocr_flags: [
                    '-psm 6',       // automatically detect page orientation
                    '-l eng',       // use a custom language file
                   'alphanumeric'
                ]
            };

            let processor = pdf_extract(filePath, options, function(err, data) {
                if (err) {
                    console.log(err);
                    reject(err);
                }
            });
            processor.on('error', function(err) {
                console.log(err, 'error while extracting pages');
                reject(err);
            });
            processor.on('complete', function(data) {
                fse.ensureDirSync(__dirname+ '/../output/');
                let outputFileLink, outputJSONFileLink, outputPDFFileLink;
                let textDataArr = [];
                let pageIndex = 1;
                if (Array.isArray(data.outputFiles)){
                   async.forEachSeries(data.outputFiles, function (file, cb) {
                        outputFileLink = __dirname+ '/../output/'+ path.basename(filePath)+ '-'+ (pageIndex++)+'.txt';
                        outputJSONFileLink = __dirname+ '/../output/'+ path.basename(filePath)+'.json';
                        textExtract.process(file, function (err, pdfTextContent) {
                            console.log('pdfTextContent', pdfTextContent);
                           let records = parseStringContentAsArray(pdfTextContent);
                           console.log(records);
                           records.map(recordItem => {
                               textDataArr.push(recordItem);
                           });

                           //textDataArr.push(data);
                           outputPDFFileLink = __dirname+ '/../output/'+ path.basename(file)+'.txt';
                           fs.writeFileSync(outputFileLink, pdfTextContent);
                           // fs.linkSync(file, outputPDFFileLink);
                           //fs.unlinkSync(file);
                           cb(null);
                       });


                    }, function (err) {
                       debugger;
                       let jsonDoc = parseStringContentAsJSON(textDataArr);
                       console.log('parsedJson', jsonDoc);
                      // fs.writeFileSync(outputFileLink, contents);
                       jsonfile.writeFileSync(outputJSONFileLink, jsonDoc, {spaces: 4});
                       resolve(data.outputFiles);
                   });
                }
                //replace(/\n\s*\n/g, '\n')

            });

            processor.on('log', function(data) {
                console.log('log event fired');
            });

            processor.on('page', function(data) {
                console.log('page event fired');
            });

    });
};



module.exports.parseAsArrayRecords = function (contents) {

    let $ = cheerio.load(contents, {
        ignoreWhitespace: true,
        xmlMode: true
    });

    let lines = $('line').toArray();
    lines = _.chain(lines).sortBy(function (lineItem) {
        return parseFloat($(lineItem).attr('xMin'));
    }).sortBy(function (lineItem) {
        return parseFloat($(lineItem).attr('yMin'));
    }).value();

    let wordItems = [];
    lines.map(line => {
        let wordItem = {
            text: _.trim($(line).text()),
            xMin : parseInt( $(line).attr('xMin')),
            xMax : parseInt( $(line).attr('xMax')),
            yMin : parseInt( $(line).attr('yMin')),
            yMax : parseInt( $(line).attr('yMax')),
        };
        wordItems.push(wordItem);
    });

    let linesArray = [];
    let lineGroup  = _.groupBy(wordItems, item => item.yMin);
    Object.keys(lineGroup).forEach(function (lineKey) {
        linesArray.push(_.sortBy(lineGroup[lineKey], item => item.xMin));
    });
    console.log(linesArray);

    return linesArray;
};


module.exports.parsePdfFileInfo = function (filePath) {

    return new Promise(function (resolve, reject) {
        pdfUtil.info(filePath, function (err, infoData) {
            if(err){
                reject(err);
            } else {
                console.log('Found Pdf Info details for '+ filePath , infoData);
            }
        })
    });
};


let blackListedWords = [];

function parseStringContentAsArray(contents) {

    let objArr = [];
    let lineContents = contents.split('\n');
    lineContents = lineContents.filter(function (strContent) {
        return (/page \d+ of \d+/gi.test(strContent) === false);
    });
    lineContents.forEach(function (lineStr) {
        let str= lineStr;
        let colArr = _.compact(str.split(/(\s\s\s+)/)).filter(function (item) {
            let _trimmedText = _.trim(item).toLowerCase();
            if (_trimmedText.length === 0 || _trimmedText.length === 1){
                return false;
            }
            if (blackListedWords.indexOf(_trimmedText) > -1){
                return false;
            }
            return true;
        });
        if (colArr.length > 0){
            colArr = colArr.map(item => replaceAnsi(item));
            colArr = colArr.filter(item => item.length > 1);
            objArr.push(colArr);
        }

    });
    return _.compact(objArr);
}


function isTableNameLikeString(content) {
    //console.log('content', content);
    return /period/gi.test(content) && ( (/\d{1,2}\/\d{1,2}\/\d{2,4}/gi.test(content)) || (/\d{2,4}\/\d{1,2}\/\d{1,2}/gi.test(content)) || (/\d{1,2}-\d{1,2}-\d{2,4}/gi.test(content)) || (/\d{2,4}\-\d{1,2}\/\d{1,2}/gi.test(content)) || (/\w+\s\d{2},\s\d{4}/gi.test(content))  )
}

function parseStringContentAsJSON(contentsArr) {
    debugger;
    let activeTables = [{rows: []}];
    let activeRows = [];
    let _lastColSize;
    let filteredContentsArr = contentsArr.filter(item => {
        if (item.length === 1){
            return isTableNameLikeString(item.join(' '));
        } else return item.length > 1;
    });

    let contentLen = filteredContentsArr.length;

    //console.log('colXMap', colXMap);
    for (let i=0; i < contentLen; i++){
        let contentRow = filteredContentsArr[i];
        let nextContentRow = filteredContentsArr[i+1];
        let prevContentRow = filteredContentsArr[i-1];
        let _lastColSize= _.size(contentRow);
        if (contentRow.length > 1){
            _lastColSize = contentRow.length;
            let nextContentRowLen = nextContentRow ? nextContentRow.length: undefined;
            let prevContentRowLen = prevContentRow ? prevContentRow.length: undefined;
            if (nextContentRowLen && nextContentRowLen === _lastColSize || (nextContentRowLen -1 === _lastColSize)){
                _.last(activeTables).rows.push(contentRow);
            } else if (prevContentRowLen && prevContentRowLen === _lastColSize || (prevContentRowLen -1 === _lastColSize)) {
                _.last(activeTables).rows.push(contentRow);
            } else {
                activeTables.push({rows: []});
                _.last(activeTables).rows.push(contentRow);
            }
        } else {
            if (!_.last(activeTables).name){
                _.last(activeTables).name = _.head(contentRow);
            }
        }
    }


    //console.log('activeTables', activeTables);
    let jsonDoc = { tables : []};

    activeTables.forEach(function (tableElem) {
        let headerRow;
        let dataRows  = [];
        if (tableElem && tableElem.rows && tableElem.rows.length > 0){
            let _maxColCount = _.max(tableElem.rows.map(function (rowItem) {
                return _.size(rowItem);
            }));
            if (_maxColCount > 2){
                let headerRow = _.head(tableElem.rows);
                headerRow = headerRow.map(row => _.camelCase(row));
                let remainingRows = tableElem.rows.slice(1);
                if (remainingRows.length > 0){
                    remainingRows.forEach(function (rowElement) {
                        let dataItem = {};
                        let rowElementLen = rowElement.length;
                        if (headerRow.length < rowElementLen && headerRow.indexOf('name') === -1){
                            headerRow.unshift('name');
                        }
                        for (let i=0; i< rowElementLen; i++){
                            if (headerRow[i]){
                                let colName = headerRow[i];
                                let colData = rowElement[i];
                                dataItem[colName] = colData;
                            }
                        }
                        console.log('dataItem', dataItem);
                        dataRows.push(dataItem);
                    });

                    jsonDoc.tables.push({ name: tableElem.name,rows: dataRows});
                }
            } else if (_maxColCount === 2){
                jsonDoc.tables.push({name: tableElem.name,  rows: []});
                let tableRows = tableElem.rows;
                for (let n=0; n < tableRows.length; n++){
                    let rowItem = tableRows[n];
                    let dataItem = {};
                        if (_.head(rowItem)){
                            dataItem[_.head(rowItem)] = rowItem[1];
                        }
                        dataRows.push(dataItem);
                }
                _.last(jsonDoc.tables).rows = dataRows;
            }
        }
    });


   return jsonDoc;
}


let knownHeaders = ['september' , 'current period', 'Year 0'];
function _isHeaderLike(row) {
    let isValid = false;
    for (let i=0; i< row.length;i++){
        let colVal = row[i].text;
        ///^market$/i.test(colVal) || /^office$/i.test(colVal) ||
        //|| /^office$/i.test(colVal) || /^Year 0$/i.test(colVal) || /^Industry$/

        knownHeaders.forEach(function (header) {
            if (new RegExp('^'+header, 'i').test(colVal)){
                isValid = true;
            }
        });

        if (isValid){
            break;
        }

    }
    return isValid;
}
module.exports.parsePdfFileAsJSON = function (filePath) {

    return new Promise((resolve, reject) => {
        let pdfParser = new PDFParser();
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError) );
        pdfParser.on("pdfParser_dataReady", pdfData => {
            debugger;
            console.log('pdfData.formImage', pdfData.formImage);
            let rows = parseTableData(pdfData.formImage);
            let activeTables = [];
            let activeRows = [];
            let _lastColSize;
            rows.forEach(function (row) {
                console.log(row);
                if (_.size(row) > 1){
                    if(isValidHeaderExists(row)){
                        activeTables.push({rows: []});
                        _lastColSize = _.size(row);
                        _.last(activeTables).rows.push(row);
                    } else if(_lastColSize ){
                        //console.log(_lastColSize, _.size(row));
                        if (_.size(row) === _lastColSize || (_.size(row) -1) === _lastColSize || (_.size(row) -2) === _lastColSize){
                            activeRows.push(row);
                            _.last(activeTables).rows.push(row);
                        } else {
                            _lastColSize = undefined;
                        }

                    } else {
                        _lastColSize = undefined;
                    }
                }
            });

            let jsonDoc = { tables : []};

            activeTables.forEach(function (tableElem) {
                if (tableElem && tableElem.rows && tableElem.rows.length > 0){
                    let headerRow = _.head(tableElem.rows);
                    headerRow = headerRow.map(row => _.camelCase(row));
                    let remainingRows = _.compact(tableElem.rows.slice(1));
                    if (remainingRows.length > 0){
                        let dataRows  = [];
                        remainingRows.forEach(function (rowElement) {
                            let dataItem = {};
                            for (let i=0; i< rowElement.length; i++){
                                if (!headerRow[i] && !dataItem.name){
                                    headerRow[i] = 'name';
                                }
                                if (headerRow[i]){
                                    let colName = headerRow[i];
                                    let colData = rowElement[i];
                                   // console.log(colName, colData);
                                    dataItem[colName] = colData;
                                }
                            }
                            //console.log(dataItem);
                            dataRows.push(dataItem);
                        });
                        jsonDoc.tables.push({ rows: dataRows});
                    }

                }
            });

            jsonfile.writeFileSync(__dirname+ '/'+ path.basename(filePath) +'.json', jsonDoc, {spaces: 4});
        });
        pdfParser.loadPDF(filePath);
    });

};


function urldecode(url) {
    return decodeURIComponent(url.replace(/\+/g, ' '));
}

function getText(marks, ex, ey, v) {
    var x = marks[0].x;
    var y = marks[0].y;

    var txt = '';
    for (var i = 0; i < marks.length; i++) {
        var c = marks[i];
        var dx = c.x - x;
        var dy = c.y - y;

        if (Math.abs(dy) > ey) {
            txt += "\"\n\"";
            if (marks[i+1]) {
                // line feed - start from position of next line
                x = marks[i+1].x;
            }
        } else {
            if (Math.abs(dx) > ex) {
                txt += "\",\"";
            }
        }

        var cell = '';
        for (var j = 0; j < c.R.length; j++) {
            cell += c.R[j].T;
        }
        txt += urldecode(cell);

        x = c.x;
        y = c.y;
    }

    return txt;
}




function parseTableData(formImage) {
    var smallestYValueForPage = [];


    for (var p = 0; p < formImage.Pages.length; p++) {
        var page = formImage.Pages[p];

        var smallestYValue = null; // per page

        var textsWithSameXvalues = {};

        for (var t = 0; t < page.Texts.length; t++) {
            var text = page.Texts[t];
            if(!textsWithSameXvalues[text.x]) {
                textsWithSameXvalues[text.x] = [];
            }
            textsWithSameXvalues[text.x].push(text);
        }

        // find smallest y distance:
        for(var x in textsWithSameXvalues){
            var texts = textsWithSameXvalues[x];
            for (var i = 0; i < texts.length; i++) {
                for (var j = 0; j < texts.length; j++) {
                    if(texts[i] !=texts[j]) {
                        var distance = Math.abs(texts[j].y - texts[i].y);
                        if(smallestYValue === null || distance < smallestYValue) {
                            smallestYValue = distance;
                        }
                    }
                };
            };
        }

        if(smallestYValue === null) smallestYValue = 0;
        smallestYValueForPage.push(smallestYValue);
    }


    // now lets find Texts with 'the same' y-values, Actually y-values in the range of y-smallestYValue and y+smallestYValue:
    var myPages = [];

    for (var p = 0; p < formImage.Pages.length; p++) {
        var page = formImage.Pages[p];

        var rows = []; // store Texts in rows

        for (var t = 0; t < page.Texts.length; t++) {
            var text = page.Texts[t];

            var foundRow = false;
            for (var r = rows.length - 1; r >= 0; r--) {

                // y value of Text falls within the y-value range, add text to row:
                var maxYdifference = smallestYValueForPage[p];
                if(rows[r].y - maxYdifference < text.y && text.y < rows[r].y + maxYdifference) {

                    // only add value of T to data (which is the actual text):
                    for (var i = 0; i < text.R.length; i++) {
                        rows[r].data.push(urldecode(text.R[i].T));
                    };
                    foundRow = true;
                }
            };
            if(!foundRow){
                // create new row:
                var row = {
                    y: text.y,
                    data: []
                };

                // add text to row:
                for (var i = 0; i < text.R.length; i++) {
                    row.data.push(urldecode(text.R[i].T));
                };

                // add row to rows:
                rows.push(row);
            }

        };

        // add rows to pages:
        myPages.push(rows);
    };

    // flatten pages into rows:
    var rows = [];

    for (var p = 0; p < myPages.length; p++) {
        for (var r = 0; r < myPages[p].length; r++) {
            rows.push(myPages[p][r].data)
        };
    };
   // rows.forEach((row)=>  console.log(row));
    return rows;
    // return callback:
}


function replaceAnsi(str) {
    var reAstral = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

    return stripAnsi(str).replace(reAstral, ' ');
};
