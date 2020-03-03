//
// Copyright (c) Viveris Technologies.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

var currentGran = 1;

//Set granularity from browser storage
function initGranularity(){
  // Get existent granularity if already stored with the storage API.
  var gettingStoredStats = browser.storage.local.get("granularity");
  gettingStoredStats.then(results => {
    if (results.granularity) {
      currentGran = results.granularity.value;
    }
  });
}

function elementExists(elementId){
  var element = document.getElementById(elementId);
  return element != null;
}

// Enable the "Stats for nerds" panel
function enableSFN() {
  var element = document.getElementById('movie_player');
  var e = element.ownerDocument.createEvent('MouseEvents');
  e.initMouseEvent('contextmenu', true, true,
       element.ownerDocument.defaultView, 1, 0, 0, 0, 0, false,
       false, false, false,2, null);
  bool = !element.dispatchEvent(e);
  var classes = document.getElementsByClassName('ytp-menuitem');
  for (var i = 0; i < classes.length; i++){
    var content = classes[i].textContent;
    //if (i == classes.length - 1){ ==> take the last element in the list, check there is not other ytp-menuitem classes
    if (content.includes('nerd') || content.includes('Statistiques') ){
      var sfn_button = classes[i];
      sfn_button.click();
    }
  }
}

// Hide the "Stats for nerds" panel
function hideSFN() {
  var panels = document.getElementsByClassName('html5-video-info-panel');
  panels[0].style.display="none"
}

// Helper function which checks if 
function isPlayingAd(){
  const element = document.querySelector('.ytp-play-progress');
  const barColor = document.defaultView.getComputedStyle(element,null).getPropertyValue("background-color")
  if (barColor == 'rgb(255, 204, 0)'){
    return true;
  }
  else{
    return false;
  }
}

// Get all stats from Stats for nerds panel:
function getStatsFromSFN(){
  var sfn_panel_content = document.getElementsByClassName('html5-video-info-panel-content')[0];
  var sfn_elements = sfn_panel_content.getElementsByTagName('div');
  var stats = {}
  var searchList = {
    droppedFrames: 'Viewport / Frames.+/ ([0-9]+) dropped of ([0-9]+)',
    currentAndOptimalRes: 'Current / Optimal Res(.+)/ (.+)',
    connectionSpeed: 'Connection Speed([0-9]+ .bps)',
    networkActivity: 'Network Activity([0-9]+ .B)',
    bufferHealth: 'Buffer Health([0-9]+[.]?[0-9]* s)',
    mysteryText: 'Mystery Text(.+)'
  }
  for (var i = 0 ; i < sfn_elements.length ; i++){
    for (var stat in searchList){
      var re = new RegExp(searchList[stat],'i');
      var match = sfn_elements[i].textContent.match(re);
      if (match){
        switch (stat){
          case 'currentAndOptimalRes':
            stats["currentRes"] = match[1];
            stats["optimalRes"] = match[2];
            break;
          case 'droppedFrames':
            stats[stat] = match[1] + '/' + match[2];
            break;
          default:
            stats[stat] = match[1];
        }
        delete searchList[stat];
      }
    }
  }
  stats["isPlayingAd"] = isPlayingAd();
  return stats;
}

// Start retrieving the stats from SFN panel every 1s
function startRetrievingSFN(){
  var ytStats = getStatsFromSFN();
  // Transmission id = 2
  ytStats.txId = 2;
  //Send SFN internally to popup.js and background.js
  var sending = browser.runtime.sendMessage(ytStats);
  //null parameters to don't handle responses/errors
  sending.then(null,null);
  setTimeout(startRetrievingSFN,currentGran*1000);
}

function handleMessage(request, sender) {
  if (request.txId == 1){
    if (!elementExists('movie_player')) {
      //Browser does not request a new page when user selects a video.
      //The page which has the video do display is dynamically generated. 
      //So, we force browser to reload the page (request for the page to the server).
      document.location.reload(true);
    }
    if (!retrievingSFN){
      enableSFN();
      hideSFN();
      startRetrievingSFN();
      retrievingSFN = true;
    }
  }
}

//Check granularity changes and updates its value if necessary
function checkGranularity(){
  var gettingGranularity = browser.storage.local.get("granularity");
  gettingGranularity.then(results => {
    if (!results.granularity) {
      return
    }
    if (currentGran != results.granularity.value){
      currentGran = results.granularity.value;
    }
  });
}

if (!browser.storage.onChanged.hasListener(checkGranularity)){
  browser.storage.onChanged.addListener(checkGranularity);
}
browser.runtime.onMessage.addListener(handleMessage);

initGranularity()

var retrievingSFN = false;
var currentUrl = window.location;
// TODO: check if !retrievingSFN condition is necessary --> test it with and without
if (currentUrl.pathname == '/watch' && !retrievingSFN){
  enableSFN();
  hideSFN();
  startRetrievingSFN();
  retrievingSFN = true;
}

