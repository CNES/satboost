//
// Copyright (c) Viveris Technologies.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

function goToMainPage() {
  window.location.href = "popup.html";
}

var goToMainPageButton = document.getElementById("goToMainPageButtonFromInfo");
goToMainPageButton.addEventListener("click", goToMainPage, false);

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
