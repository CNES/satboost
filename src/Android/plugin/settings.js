//
// Copyright (c) Viveris Technologies.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

function goToMainPage() {
  window.location.href = "popup.html";
}

// Get object from FormData
function objectify(formData){
  var data = {};
  formData.forEach(function(value, key){
    data[key] = value;
  });
  return data;
}

// Apply  granularity, alerting and counting settings
function applySettings() {
  var dataObjects = {};
  var formsList = document.getElementsByTagName("form");
  for (var i = 0; i < formsList.length; i++){
    var id = formsList[i].id;
    var formData = new FormData(formsList[i]);
    dataObjects[id] = objectify(formData);
  }
  if (dataObjects.count.interval == 'limited'
    && (dataObjects.count["start-time"] == ''
    || dataObjects.count["end-time"] == ''))
  {
    alert("You need to set an interval of time.");
    return;
  }
  if (dataObjects.broadcast.enable == 'on'
    && (dataObjects.broadcast.ip== ''
    || dataObjects.broadcast.port == ''))
  {
    alert("You need to set an IP address and a destination port.");
    return;
  }
  //Remove useless key
  dataObjects["granularity"] = dataObjects["granularity"]["granularityVal"];
  //Update Granularity on local storage
  var results = {
    "granularity": {"value": dataObjects["granularity"]}
  };
  browser.storage.local.set(results);
  // Send conf to daemon
  var xhr = new XMLHttpRequest();
  var url = "http://localhost:8123/?action=setConf";
  xhr.open("PUT", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  var data = JSON.stringify(dataObjects);
  xhr.send(data);
}

// Get current counting and alerting confs
function displayCurrentConf() {
  var alertCheckboxes = ["downloadAlert", "uploadAlert"]
  var alertMb = ["downloadMb", "uploadMb"]
  var xhr = new XMLHttpRequest();
  var url = "http://localhost:8123/?type=tsConf";
  xhr.open("GET", url, true);
  xhr.send();
  xhr.onreadystatechange = function(){
    if(xhr.readyState === 4 && xhr.status === 200){
      var jsonConf = JSON.parse(xhr.responseText);
      document.getElementById("granularityVal").value = jsonConf["granularity"];
      if (jsonConf["count"]["interval"] == "always"){
        document.getElementById("always").checked = true;
      }
      else {
        document.getElementById("interval").checked = true;
        document.getElementById("start-time").value = jsonConf["count"]["start-time"];
        document.getElementById("end-time").value = jsonConf["count"]["end-time"];
      }
      if ("alerts" in jsonConf){
        for(var i = 0 ; i < alertCheckboxes.length ; i++){
          var checkbox = alertCheckboxes[i];
          var limit = alertMb[i];
          if (checkbox in jsonConf["alerts"]){
            document.getElementById(checkbox).checked = true; 
            document.getElementById(limit).value = jsonConf["alerts"][limit];
          }
        }
      }
      if (Object.keys(jsonConf.broadcast).length > 0 ){
          document.getElementById("broadcastEnable").checked = true;
          document.getElementById("broadcastIp").value = jsonConf.broadcast.ip
          document.getElementById("broadcastPort").value = jsonConf.broadcast.port
      }
    }
  };
}

var applySettingsButton = document.getElementById("applySettingsButton");
applySettingsButton.addEventListener("click", applySettings, false);

var goToMainPageButton = document.getElementById("goToMainPageButton");
goToMainPageButton.addEventListener("click", goToMainPage, false);

displayCurrentConf();
