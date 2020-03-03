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

function retrieveYtStats(request, sender, sendResponse){
  if (request.txId != 2) {
    return;
  }
  //Remove some useless information (for now...)
  delete request.txId;
  delete request.mysteryText;
  delete request.isPlayingAd;
  //Get the number of freezings from daemon 
  var xhr = new XMLHttpRequest();
  var url = "http://localhost:8123/?type=ytStats";
  xhr.open("GET", url, true);
  xhr.send();
  xhr.onreadystatechange = function(){
    if(xhr.readyState === 4 && xhr.status === 200){
      var freezings = JSON.parse(xhr.responseText)["freezings"];
      document.getElementById("freezings").textContent = freezings;
    }
  };
  for (const [stat, value] of Object.entries(request)) {
    document.getElementById(stat).textContent = value;
  }
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

//clean Youtube stats (freezings counter)
function clearYoutubeStats(){
  var xhr = new XMLHttpRequest();
  var url = "http://localhost:8123/?action=clearYtStats";
  xhr.open("PUT", url, true);
  xhr.send();
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

//apply an HTTP optimization profile
function applyProfile(){
  accept = confirm("Firefox will be restarted in order to apply HTTP Optimization.\nIt will keep the sessions open to not lose your navigation tabs.\n Do you want to continue ?");
  if (!accept){
    return
  }
  var profile = document.getElementById('profile-select');
  var value = profile.options[profile.selectedIndex].value
  if(value == ''){
    alert("You need to select a profile.");
    return;
  }
  //Store the current profile
  browser.storage.local.get('currentProfile', function(data) {
    data.currentProfile = value;
    browser.storage.local.set(data);
  });
  //Send the application request to the daemon
  var xhr = new XMLHttpRequest();
  var url = "http://localhost:8123/?action=applyProfile";
  xhr.open("PUT", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  var data = JSON.stringify(profiles[value]);
  xhr.send(data);
}

function displayCurrentProfile() {
  var gettingStoredStats = browser.storage.local.get('currentProfile');
  gettingStoredStats.then(result =>{
    var currentProfile = 'No profile applied yet';
    if ('currentProfile' in result){
      currentProfile = result.currentProfile;
    }
    document.getElementById("currentProfile").textContent = currentProfile;
  });
}

function goToSettings() {
  window.location.href = "settings.html";
}

function updateProfileSelect(){
  for (const param of Object.keys(profiles)) {
    var paramCapitalized = param.charAt(0).toUpperCase() + param.slice(1)
    document.getElementById('profile-select').innerHTML += '<option value="' + param + '">' + paramCapitalized + '</option>'
  }
}

getAlertLimits();

if (!browser.storage.onChanged.hasListener(retrieveTrafficStats)){
  browser.storage.onChanged.addListener(retrieveTrafficStats);
}

if (!browser.runtime.onMessage.hasListener(retrieveYtStats)){
  browser.runtime.onMessage.addListener(retrieveYtStats);
}

var clearStatsButton = document.getElementById("clearStatsButton");
clearStatsButton.addEventListener("click", clearTrafficStats, false);

var clearYtStatsButton = document.getElementById("clearYtStatsButton");
clearYtStatsButton.addEventListener("click", clearYoutubeStats, false);

var applyProfileButton = document.getElementById("applyProfileButton");
applyProfileButton.addEventListener("click", applyProfile, false);

var goToSettingsButton = document.getElementById("settingsButton");
goToSettingsButton.addEventListener("click", goToSettings, false);

displayCurrentProfile();
updateProfileSelect();

