//
// Copyright (c) Alexander Vykhodtsev.
// Licensed under the MIT license. See LICENSE file in the project root for details.
//

(function(){
  'use strict';

  if (document.readyState === 'complete') {
    startCollect();
  } else {
    window.addEventListener('load', startCollect);
  }

  function startCollect() {
    setTimeout(function() {
      const l = performance.getEntriesByType('navigation')[0].toJSON();
      if (l.duration > 0) {
        // we have only 4 chars in our disposal including decimal point
        var t = (l.duration / 1000).toFixed(2);
        browser.runtime.sendMessage({txId: 3, time: t, timing: l});
      }
    }, 0);
  }
})();

