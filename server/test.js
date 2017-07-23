/**
 * Created by sajibsarkar on 6/28/17.
 */
'use strict';

const fs = require('fs');
const _ =require('lodash');

const s = require("underscore.string");
const cheerio = require('cheerio');
_.mixin(s.exports());


function parseHtmlSchemaFile(url) {
    return new Promise((resolve, reject) =>{
       fs.readFile(url, 'utf-8', function (err, contents) {
           if (err){
               return reject(err);
           }
           let $ = cheerio.load(contents, {
               ignoreWhitespace: true,
               xmlMode: true
           });

           let blockCollections = $('block').toArray();

           blockCollections = _.sortBy(blockCollections, function (item) {
               return parseInt ($(item).attr('yMin'));
           });

           let xMins = [];


           blockCollections.forEach(function (blockItem) {
               xMins.push(parseInt( $(blockItem).attr('xMin')));
              // console.log('blockItem', parseInt( $(blockItem).attr('xMin')));

           });

           let blockGroup = _.groupBy(blockCollections, function (blockItem) {
               return parseInt( $(blockItem).attr('xMin'));
           });

           console.log(blockGroup);



           let lines = $('line').toArray();
           lines = _.chain(lines).sortBy(function (lineItem) {
                return parseFloat($(lineItem).attr('yMin'));
           }).value();

            let wordItems = [];
            lines.map(line => {
               let wordItem = {
                   text: _.chain($(line).text()).trim().cleanDiacritics().value(),
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
           //console.log(linesArray);
           resolve(linesArray);
       });
    });
}



parseHtmlSchemaFile(__dirname+'/test.html').then(function (output) {
    //output =  output.filter(item => item.line_num > 0);

    analyzePdfData(output);

});


function analyzePdfData(output) {
    let groupedOutputByPageNumber = _.groupBy(output, 'page_num');
    Object.keys(groupedOutputByPageNumber).forEach(function (pageKey) {
        console.log('pageKey', pageKey);
        extractPdfLineRows(groupedOutputByPageNumber[pageKey]);
    });
}


function extractPdfLineRows(rows) {
    let groupedByBlockNum = _.groupBy(rows, 'block_num');
    Object.keys(groupedByBlockNum).forEach(function (blockKey) {
        if (blockKey === '1'){
            let blockMetaData = groupedByBlockNum[blockKey].find(item => item.level === 2);
            let groupedByParaGraph = _.groupBy(groupedByBlockNum[blockKey], 'par_num');
            Object.keys(groupedByParaGraph).forEach(function(paraKey){
                groupedByParaGraph[paraKey].forEach(function (paraItem) {
                    if (paraItem.level === 5){
                        console.log('paraItem', paraItem);
                    }
                });
            });
        }

    });

}