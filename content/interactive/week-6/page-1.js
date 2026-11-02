
/* ECOD LMS embed bridge: report height and completion to the LMS page */
(function(){
  if (window.parent === window) return;
  var send = function(extra){
    var msg = {type:"ecod-interactive", height: document.documentElement.scrollHeight};
    if (extra) for (var k in extra) msg[k] = extra[k];
    try { window.parent.postMessage(msg, window.location.origin); } catch (e) {}
  };
  window.__ecodNotify = function(event, detail){ send({event:event, detail:detail}); };
  window.addEventListener("load", function(){ send(); });
  if (window.ResizeObserver) new ResizeObserver(function(){ send(); }).observe(document.documentElement);
  window.addEventListener("hashchange", function(){ setTimeout(send, 50); });
})();
