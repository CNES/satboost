//
// Copyright (c) Alexey Migutsky.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var $id, disable, enable, getUri, state, stats;

stats = require('../stats');

state = require('../state')();

$id = require('../helpers').$id;

getUri = require('../helpers').getUriFromTab;

browser.tabs.query({
  currentWindow: true,
  active: true
}).then(function(tab) {
  tab = tab[0];
  stats.get(tab.id, function(stat) {
    if (stat == null) {
      stat = {
        count: 0,
        libs: []
      };
    }
    $id('resources-count').innerHTML = stat.count;
    return $id('total-resources-count').innerHTML = stats.allStats.count;
  });
  state.get(tab.id, function(pageConfig) {
    if (pageConfig.disabled) {
      disable();
    } else {
      enable();
    }
    return $id('switch').addEventListener('change', function(e) {
      if (this.checked) {
        pageConfig.disabled = false;
        enable();
      } else {
        pageConfig.disabled = true;
        disable();
      }
      return state.sync(pageConfig);
    });
  });
  return $id('site-id').innerHTML = getUri(tab);
});

disable = function() {
  $id('enabled').style.display = 'none';
  $id('disabled').style.display = 'inline';
  return $id('switch').checked = false;
};

enable = function() {
  $id('disabled').style.display = 'none';
  $id('enabled').style.display = 'inline';
  return $id('switch').checked = true;
};


},{"../helpers":3,"../state":4,"../stats":5}],2:[function(require,module,exports){
module.exports = {
  VERSION_TAG: /\$version\$/,
  NAME_TAG: /\$name\$/,
  URL_QUERY_TAG: /\?.+$/
};


},{}],3:[function(require,module,exports){
var $id, fn, getUriFromTab, js, parseUrl, random;

parseUrl = require('./url');

js = function(filename) {
  return browser.extension.getURL(['/injectees/', filename].join(""));
};

random = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

$id = function(id) {
  return document.getElementById(id);
};

fn = {
  not: function(cb) {
    return function() {
      return !cb(...arguments);
    };
  }
};

// return normalized website URI
getUriFromTab = function(tab) {
  return parseUrl(tab.url.replace(/#.*$/, '')).host;
};

module.exports = {js, random, $id, fn, getUriFromTab};


},{"./url":6}],4:[function(require,module,exports){
var getUri, load;

getUri = require('./helpers').getUriFromTab;

load = function() {
  var state;
  if (localStorage["state"]) {
    state = JSON.parse(localStorage["state"]);
  }
  if (state == null) {
    state = {};
  }
  state.get = function(tabId, cb) {
    return browser.tabs.get(tabId, (tab) => {
      var id, pageConfig;
      id = getUri(tab);
      pageConfig = state[id] || {id};
      return cb(pageConfig);
    });
  };
  state.forHost = function(host) {
    return state[host];
  };
  state.sync = function(pageConfig) {
    state[pageConfig.id] = pageConfig;
    localStorage["state"] = JSON.stringify(this);
    return this;
  };
  return state;
};

module.exports = load;


},{"./helpers":3}],5:[function(require,module,exports){
var base, getUriFromTab, random, stats,
  indexOf = [].indexOf;

random = require('./helpers').random;

getUriFromTab = require('./helpers').getUriFromTab;

if (localStorage["stats"]) {
  stats = JSON.parse(localStorage["stats"]);
}

if (stats == null) {
  stats = {};
}

if (stats.tabStats == null) {
  stats.tabStats = {};
}

if (stats.allStats == null) {
  stats.allStats = {
    count: 0
  };
}

if ((base = stats.allStats).libs == null) {
  base.libs = {};
}

console.log(stats);

stats.addBoost = function(tabId, normalizedUrl) {
  browser.tabs.get(tabId).then((tab) => {
    var entry, lib, pageUrl;
    // .url requires "tabs" permission
    pageUrl = getUriFromTab(tab);
    //		console.log tabId, normalizedUrl
    if (!this.tabStats[pageUrl]) {
      this.tabStats[pageUrl] = {
        count: 0,
        libs: []
      };
    }
    entry = this.tabStats[pageUrl];
    lib = normalizedUrl.library;
    // add stat for current tab
    entry.count += 1;
    if (indexOf.call(entry.libs, lib) < 0) {
      entry.libs.push(lib);
    }
    // add global stat
    stats.allStats.count += 1;
    if (stats.allStats.libs[lib]) {
      stats.allStats.libs[lib].count += 1;
    } else {
      stats.allStats.libs[lib] = {
        count: 1
      };
    }
    return localStorage["stats"] = JSON.stringify(this);
  });
  return this;
};

stats.get = function(id, cb) {
  return browser.tabs.get(id).then((tab) => {
    return cb(stats.tabStats[getUriFromTab(tab)]);
  });
};

module.exports = stats;


},{"./helpers":3}],6:[function(require,module,exports){
var sx,
  slice = [].slice;

sx = require('./checkers/config-syntax');

module.exports = function(url) {
  var lib, parsed, parsedLibrary, path, result, schema;
  parsed = url.split('://');
  [schema, path] = parsed;
  result = {
    schema,
    uri: path.replace(sx.URL_QUERY_TAG, '')
  };
  //result.isExtension = result.schema is 'chrome-extension'
  parsedLibrary = result.uri.split('/');
  [lib] = slice.call(parsedLibrary, -1);
  result.host = parsedLibrary[0];
  result.library = lib;
  return result;
};


},{"./checkers/config-syntax":2}]},{},[1]);
