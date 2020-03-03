//
// Copyright (c) Alexander Vykhodtsev and Viveris Technologies.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

var trafficStats = {
  downlinkRate: 0,
  uplinkRate: 0,
  downlinkData: 0,
  uplinkData: 0
}
var currentGran = 1; //Current monitoring granularity

//Get granularity from daemon in seconds
function initGranularity(){
  // Get existent granularity if already stored with the storage API.
  var gettingStoredStats = browser.storage.local.get("granularity");
  gettingStoredStats.then(results => {
    if (results.granularity) {
      currentGran = results.granularity.value;
    }
    else {
      // Get granularity from Daemon
      var xhr = new XMLHttpRequest();
      var url = "http://localhost:8123/?type=tsConf";
      xhr.open("GET", url, true);
      xhr.send();
      xhr.onreadystatechange = function(){
        if(xhr.readyState === 4 && xhr.status === 200){
          var jsonConf = JSON.parse(xhr.responseText);
          currentGran = Number(jsonConf["granularity"]);
          results = {
            "granularity" : {"value": currentGran}
          };
        browser.storage.local.set(results);
        }
      };
    }
  });
}

function getTrafficStats() {
  // Load existent stats with the storage API.
  var gettingStoredStats = browser.storage.local.get("trafficStats");
  gettingStoredStats.then(results => {
    // Initialize the saved stats if not yet initialized.
    if (!results.trafficStats) {
      results = {
        trafficStats
      };
    }
    // Get the traffic stats from the server.
    var xhr = new XMLHttpRequest();
    var url = "http://localhost:8123/?type=tsValues";
    xhr.open("GET", url, true);
    xhr.send();
    xhr.onreadystatechange = function(){
    if(xhr.readyState === 4 && xhr.status === 200){
        var jsonStats = JSON.parse(xhr.responseText);
        // Update the traffic stats.
        results.trafficStats["downlinkRate"] = jsonStats.downlinkRate;
        results.trafficStats["uplinkRate"] = jsonStats.uplinkRate;
        results.trafficStats["downlinkData"] = jsonStats.downlinkData;
        results.trafficStats["uplinkData"] = jsonStats.uplinkData;
        // Save the stats with storage API.
        browser.storage.local.set(results);
      }
    };
  });
  setTimeout(getTrafficStats,currentGran*1000);
}

function handleMessages(request, sender, sendResponse){
  //Message related to PLT
  if (request.txId == 3) {
    // This cache stores page load time for each tab, so they don't interfere
    browser.storage.local.get('pltCache', function(data) {
      if (!data.pltCache) data.pltCache = {};
      data.pltCache['tab' + sender.tab.id] = request.timing;
      browser.storage.local.set(data);
      // Prepare the detailed PLT
      var detailedPlt = {};
      detailedPlt['redirect'] = request.timing['redirectEnd'] - request.timing['redirectStart'];
      detailedPlt['dns'] = request.timing['domainLookupEnd'] - request.timing['domainLookupStart'];
      detailedPlt['connect'] = request.timing['connectEnd'] - request.timing['connectStart'];
      detailedPlt['request'] = request.timing['responseStart'] - request.timing['requestStart'];
      detailedPlt['dom'] = request.timing['domComplete'] - request.timing['responseStart'];
      detailedPlt['load'] = request.timing['loadEventEnd'] - request.timing['loadEventStart'];
      detailedPlt['total'] = request.timing['duration'];
      // Send the detailed PLT to the daemon
      var xhr = new XMLHttpRequest();
      var url = "http://localhost:8123/?type=plt";
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      var data = JSON.stringify(detailedPlt);
      xhr.send(data);
    });
    browser.browserAction.setBadgeText({text: request.time, tabId: sender.tab.id});
  }
}

//Removes plt cache for closing tabs
function pltCacheEviction(tabId){
  browser.storage.local.get('pltCache', function(data) {
    if (data.pltCache) delete data.pltCache['tab' + tabId];
    browser.storage.local.set(data);
  });
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

//Add Listeners
browser.runtime.onMessage.addListener(handleMessages);
browser.tabs.onRemoved.addListener(pltCacheEviction);
if (!browser.storage.onChanged.hasListener(checkGranularity)){
  browser.storage.onChanged.addListener(checkGranularity);
}

//Get traffic stats from daemon periodically
initGranularity();
getTrafficStats();

