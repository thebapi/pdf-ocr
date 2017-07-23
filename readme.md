#PDF-OCR is an OCR which parsed data from PDF files




### Run the Following commands to install necessary libraries.

####To begin on OSX, first make sure you have the homebrew package manager installed.

pdftk is not available in Homebrew. However a gui install is available here. https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/pdftk_server-2.02-mac_osx-10.11-setup.pkg

pdftotext is included as part of the poppler utilities library. poppler can be installed via homebrew

brew install poppler
ghostscript can be install via homebrew

brew install gs
tesseract can be installed via homebrew as well

brew install tesseract

After tesseract is installed you need to install the alphanumeric config and an updated trained data file

cd node_modules/pdf-extract/
cp "share/eng.traineddata" "/usr/local/Cellar/tesseract/3.05.01/share/tessdata/eng.traineddata"
cp "share/dia.traineddata" "/usr/local/Cellar/tesseract/3.05.01/share/tessdata/dia.traineddata"
cp "share/configs/alphanumeric" "/usr/local/Cellar/tesseract/3.05.01/share/tessdata/configs/alphanumeric"

####Ubuntu

pdftk can be installed directly via apt-get

apt-get install pdftk
pdftotext is included in the poppler-utils library. To installer poppler-utils execute

apt-get install poppler-utils
ghostscript can be install via apt-get

apt-get install ghostscript
tesseract can be installed via apt-get. Note that unlike the osx install the package is called tesseract-ocr on Ubuntu, not tesseract

apt-get install tesseract-ocr
For the OCR to work, you need to have the tesseract-ocr binaries available on your path. If you only need to handle ASCII characters, the accuracy of the OCR process can be increased by limiting the tesseract output. To do this copy the alphanumeric file included with this pdf-extract module into the tess-data folder on your system. Also the eng.traineddata included with the standard tesseract-ocr package is out of date. This pdf-extract module provides an up-to-date version which you should copy into the appropriate location on your system

cd <root of this module>
cp "./share/eng.traineddata" "/usr/share/tesseract-ocr/tessdata/eng.traineddata"
cp "./share/configs/alphanumeric" "/usr/share/tesseract-ocr/tessdata/configs/alphanumeric"