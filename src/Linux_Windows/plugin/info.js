//
// Copyright (c) Viveris Technologies.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

//Helper function to get mobile view state from user agent description
function isMobileViewEnabled (userAgent){
  if (userAgent.includes('iPhone')) return 'Enabled';
  return 'Disabled';
}

//Get the HTML code from de profile name and its parameters
function getProfileHTML(profile, params) {
  var profileHtml =
    '<div class="profile-name">' + profile + '</div>\n' +
    '<ul>\n' +
    '  <li class="param">Cache size : <span class="param-value">' + params['browser.cache.disk.capacity'] + '</span><span class="param-unit">KB</span></li>\n' +
    '  <li class="param">DNS Cache Max entries : <span class="param-value">' + params['network.dnsCacheEntries'] +'</span></li>\n' +
    '  <li class="param">DNS Cache Expiration : <span class="param-value">' + params['network.dnsCacheExpiration'] + '</span><span class="param-unit">s</span></li>\n' +
    '  <li class="param">Max parallel HTTP connexions : <span class="param-value">' + params['network.http.max-connections'] + '</span></li>\n' +
    '  <li class="param">Max parallel HTTP connexions per proxy : <span class="param-value">' + params['network.http.max-persistent-connections-per-proxy'] + '</span></li>\n' +
    '  <li class="param">Max parallel HTTP connexions per Server : <span class="param-value">' + params['network.http.max-persistent-connections-per-server'] + '</span></li>\n' +
    '  <li class="param">Mobile view : <span class="param-value">' + isMobileViewEnabled(params['general.useragent.override']) + '</span></li>\n' +
    '  <li class="param">Initial pre-rendering delay : <span class="param-value">' + params['html5.flushtimer.initialdelay']  + '</span><span class="param-unit">ms</span></li>\n' +
    '</ul>\n';
  return profileHtml;
}

function displayProfiles() {
  for (const [pName,pParams ] of Object.entries(profiles)) {
    document.getElementById('profiles').innerHTML += getProfileHTML(pName,pParams);
  }
}

function goToMainPage() {
  window.location.href = "popup.html";
}

var goToMainPageButton = document.getElementById("goToMainPageButtonFromInfo");
goToMainPageButton.addEventListener("click", goToMainPage, false);

displayProfiles();


/*******************************
 **** Code for detailed PLT ****
 *******************************/

var total = 0;

function set(id, start, end, noacc) {
  var length = Math.round(end - start);
  var x = Math.round(start / total * 300);
  document.getElementById(id + 'When').innerHTML = Math.round(start);
  document.getElementById(id).innerHTML = length;
  document.getElementById(id + 'Total').innerHTML = noacc ? '-' : Math.round(end);
  document.getElementById('r-' + id).style.cssText =
    'background-size:' + Math.round(length / total * 300) + 'px 100%;' +
    'background-position-x:' + (x >= 300 ? 299 : x) + 'px;';
}

function getSelectedTab(callback) {
  browser.tabs.query({active: true}).then(function(tabs) {
    callback(tabs[0]);
  })
}

getSelectedTab(function(tab) {
  browser.storage.local.get('pltCache', function(data) {
    var t = data.pltCache['tab' + tab.id];
    total = t.duration;

    // https://dvcs.w3.org/hg/webperf/raw-file/tip/specs/NavigationTiming/Overview.html#processing-model
    set('redirect', t.redirectStart, t.redirectEnd);
    set('dns', t.domainLookupStart, t.domainLookupEnd);
    set('connect', t.connectStart, t.connectEnd);
    set('request', t.requestStart, t.responseStart);
    set('response', t.responseStart, t.responseEnd);
    set('dom', t.responseStart, t.domComplete);
    set('domInteractive', t.domInteractive, t.domInteractive, true);
    set('contentLoaded', t.domContentLoadedEventStart, t.domContentLoadedEventEnd, true);
    set('load', t.loadEventStart, t.loadEventEnd);
    document.getElementById("total").innerHTML = Math.round(t.duration);
  });
});

