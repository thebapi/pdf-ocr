/**
 * Module which extracts text from electronic searchable pdf files.
 * Requires the "pdftotext" binary be installed on the system and accessible in the
 * current path
 */
var temp = require('temp');
var path = require('path');
var exec = require('child_process').exec;
var fs = require('fs');

/**
 * @param tif_path path to the single page file on disk containing a scanned image of text
 * @param {Array} options is an optional list of flags to pass to the tesseract command
 * @return {String} extract the extracted ocr text output
 * @return callback(<maybe error>, stdout)
 */
module.exports = function(input_path, options, callback) {
  // options is an optional parameter
  if (!callback || typeof callback != "function") {
    // callback must be the second parameter
    callback = options;
    options = [];
  }
  fs.exists(input_path, function (exists) {
    if (!exists) { return callback('error, no file exists at the path you specified: ' + input_path); }
    // get a temp output path
    var output_path = temp.path({prefix: 'ocr_output'});
    // output_path = path.join(__dirname,'test/test_data/single_page_raw');
   // var cmd = 'tesseract  -c  "'+input_path+'" "'+output_path+'"  pdf '+options.join(' ');
      var cmd = 'tesseract  "'+input_path+'" "'+output_path+'"  pdf '+options.join(' ');
      //console.log('cmd', cmd);
    var child = exec(cmd, function (err, stdout, stderr) {
      if (err) { return callback(err); }
      // tesseract automatically appends ".txt" to the output file name
       var text_output_path = output_path+'.pdf';
     // console.log('output_path', output_path+ '.hocr');
        callback(null, text_output_path);
    });
  });
};
