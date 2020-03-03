//
// Copyright (c) Viveris Technologies.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

var alertLimits = {
  downlinkData: Number.POSITIVE_INFINITY,
  uplinkData: Number.POSITIVE_INFINITY
}

function getAlertLimits(){
  var alertCheckboxes = ["downloadAlert", "uploadAlert"]
  var alertMb = ["downloadMb", "uploadMb"]
  var xhr = new XMLHttpRequest();
  var url = "http://localhost:8123/?type=tsConf";
  xhr.open("GET", url, true);
  xhr.send();
  xhr.onreadystatechange = function(){
    if(xhr.readyState === 4 && xhr.status === 200){
      var jsonConf = JSON.parse(xhr.responseText);
      if ("alerts" in jsonConf){
        if ("downloadAlert" in jsonConf["alerts"]){
          alertLimits["downlinkData"] = jsonConf["alerts"]["downloadMb"];
        }
        if ("uploadAlert" in jsonConf["alerts"]){
          alertLimits["uplinkData"] = jsonConf["alerts"]["uploadMb"];
        }
      }
    }
  };
}

function retrieveTrafficStats() {
  var gettingStoredStats = browser.storage.local.get("trafficStats");
  gettingStoredStats.then(results => {
    for (const [stat, value] of Object.entries(results.trafficStats)) {
      var s = document.getElementById(stat);
      //Prevent to show negative values due to stats clearing
      if (value < 0) {
        s.textContent = '';
      } else {
        s.textContent = statWithUnit(stat,value);
      }
      //Check if we are close or have exceeded the limits to put color:
      //Close(>85%) = Orange -- Exceeded = Red
      if (stat in alertLimits) {
        dataElement = document.getElementById(stat);
        if (value > (alertLimits[stat]*1000000)*0.85 &&
          value < alertLimits[stat]*1000000){
          dataElement.style.color = "#FFA500";
        }
        else if (value > alertLimits[stat]*1000000){
          dataElement.style.color = "#FF6347";
        }
      }
    }
  });
}

//clean traffic stats (DL and UL data)
function clearTrafficStats(){
  var xhr = new XMLHttpRequest();
  var url = "http://localhost:8123/?action=clearTrafficStats";
  xhr.open("PUT", url, true);
  xhr.send();
  //Put stats in white color
  var elements = document.querySelectorAll(".panel-stats span");
  for (var i=0; i<elements.length; i++){
    elements[i].style.color = "rgb(200, 200, 200)";
  }
}

//Convert a statistic to the most 'human readable' unit
function statWithUnit(statName, value){
  var unit = 'b';
  if (value/1000000000 > 1) {
    value = value/1000000000;
    unit = 'Gb';
  } else if (value/1000000 > 1) {
    value = value/1000000;
    unit = 'Mb';
  } else if (value/1000 > 1) {
    value = value/1000;
    unit = 'Kb';
  }
  if (statName.includes('Rate')){
    unit = unit.concat('/s');
  }
  value = value.toFixed(1);
  return value.toString().concat(' ',unit);
}

function goToSettings() {
  window.location.href = "settings.html";
}

getAlertLimits();

if (!browser.storage.onChanged.hasListener(retrieveTrafficStats)){
  browser.storage.onChanged.addListener(retrieveTrafficStats);
}

var clearStatsButton = document.getElementById("clearStatsButton");
clearStatsButton.addEventListener("click", clearTrafficStats, false);

var goToSettingsButton = document.getElementById("settingsButton");
goToSettingsButton.addEventListener("click", goToSettings, false);


