//
// Copyright (c) Viveris Technologies.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

//HTTP Optimization Profiles

profiles = {
  'default': {
    //Restore previous session
    'browser.startup.page': 3,
    'browser.sessionstore.resume_from_crash': true,
    //Cache
    'browser.cache.disk.smart_size.enabled' : false,
    'browser.cache.disk.enable': true,
    'browser.cache.disk.capacity': 256000, //KB
    //DNS Cache
    'network.dnsCacheEntries': 400, //Nb max entries
    'network.dnsCacheExpiration': 60, //seconds
    //Max parallel connections
    'network.http.max-connections': 900, //1 to 65535
    //network.http.max-connections-per-server: '',
    'network.tcp.keepalive.enabled': true,
    'network.http.request.max-start-delay': 10, //seconds
    'network.http.max-persistent-connections-per-proxy': 32,
    'network.http.max-persistent-connections-per-server': 6,
    //Mobile view
    'general.useragent.override': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:65.0) Gecko/20100101 Firefox/65.0',
    //Initial Delay
    'html5.flushtimer.initialdelay': 120, //milliseconds
  },

  'turbo': {
    //Restore previous session
    'browser.startup.page': 3,
    'browser.sessionstore.resume_from_crash': true,
    //Cache
    'browser.cache.disk.smart_size.enabled' : false,
    'browser.cache.disk.enable': true,
    'browser.cache.disk.capacity': 2097152, //KB
    //DNS Cache
    'network.dnsCacheEntries': 3000, //Nb max entries
    'network.dnsCacheExpiration': 3600, //seconds
    //Max parallel connections
    'network.http.max-connections': 1800,
    //network.http.max-connections-per-server: '',
    'network.tcp.keepalive.enabled': true,
    'network.http.request.max-start-delay': 10, //seconds
    'network.http.max-persistent-connections-per-proxy': 64,
    'network.http.max-persistent-connections-per-server': 12,
    //Mobile view
    'general.useragent.override': 'iPhone; CPU iPhone OS 12_1_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
    //Initial Delay
    'html5.flushtimer.initialdelay': 0, //milliseconds
  }
}
