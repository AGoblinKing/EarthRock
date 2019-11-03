
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function (App) {
  'use strict';

  App = App && App.hasOwnProperty('default') ? App['default'] : App;

  const app = new App({
    target: document.body,
    props: {
      name: `stage`
    }
  });

  return app;

}(App));
//# sourceMappingURL=bundle.js.map
