/* global document,window,Node,XMLHttpRequest,setTimeout,Element, define */

;(function () {

/**  
    IE8 workaround.
*/
window.console = window.console || { log: function() {} };

if (!document.documentElement.addEventListener) {
    Element.prototype.addEventListener = function (event, fnct) {
        if (this.type && /(radio|checkbox)/i.test(this.type) && event.toLowerCase() === "change") {
            this.attachEvent('onclick', fnct);  // http://stackoverflow.com/questions/10579019/onchange-on-radiobutton-not-working-correctly-in-ie8
        } else {
            this.attachEvent('on' + event, fnct);  
        }
    };
}
String.prototype.trim =  String.prototype.trim || function () { return this.replace(/^(\s+|\s+)$/g, ''); };
Array.prototype.indexOf = Array.prototype.indexOf || function(obj, start) {
    for (var i = (start || 0), j = this.length; i < j; i++) {
        if (this[i] === obj) { return i; }
    }
    return -1;
};

/**
    Contructor function to create View Models.

*/
function VM (elem) {
    this.__listeners = [];
    if(elem) this._bind(elem);
}

VM.isArray = function (obj) { return Object.prototype.toString.call( obj ) === '[object Array]';  }; 

VM.propertyValue = function (obj, path) {
    if (obj === undefined) {
        return undefined;
    }
    var propertyList = VM.isArray(path) ? path : path.split(/[\.\[\]]+/);
    return propertyList.length === 1 ? (propertyList[0] === '' ? obj : obj[propertyList[0]]) : VM.propertyValue(obj[propertyList[0]], propertyList.slice(1));
};

VM.prototype._get = function (path) {
    return VM.propertyValue(this, path);
};

VM.prototype._set = function (path, value) {
    var propertyList = path.split(/[\.\[\]]+/);
    var propName = propertyList.pop();
    while (!propName && propertyList.length) propName = propertyList.pop();
    var obj = propertyList.length > 0 ? VM.propertyValue(this, propertyList) : this;
    obj[propName] = value;
};

var Listener = function (propertyPath, listenerFn) {
    this.propertyPath = propertyPath;
    this.listenerFn = listenerFn;
};

Listener.prototype.listen = function (vm) {
    var dirty = false;
    
    var currentValue = VM.propertyValue(vm, this.propertyPath);
    if (VM.isArray(currentValue)) {
        currentValue = currentValue.length;
    }
    
    var context = vm;
    var matchArray = /^(.*\[\d+\])[^\[\]]+$/.exec(this.propertyPath);
    if (matchArray) {
        context = VM.propertyValue(vm, matchArray[1]);
    }
    if (currentValue !== this.oldValue) {
        this.listenerFn(currentValue, this.oldValue, context);
        this.oldValue = VM.isArray(currentValue) ? currentValue.length : currentValue;
        dirty = true;
    }
    return dirty;
};


    
VM.prototype._applyChanges = function () {
    var loop = 10, dirty = false;
    do {
        dirty = false;
        for (var i = 0; i < this.__listeners.length; i++) {
            dirty = this.__listeners[i].listen(this) || dirty;
        }
        if (dirty && !(loop--)) {
            throw "10 applyChanges iterations reached";
        }
    } while (dirty);
};


VM.prototype._listen = function (propertyPath, listenerFn) {
    var self = this;
    
    // first check if path contains an array reference.
    var matches = /^([^\[\]]+)\[\*\]\.(.*)$/.exec(propertyPath);
    if (matches) {
        var arrayPath = matches[1], subPath = matches[2];
        // add listener for array length, when changed: add/remove listener for array items.
        self.__listeners.push(new Listener(arrayPath, function (newValArrayLen, oldValArrayLen) {
            oldValArrayLen = oldValArrayLen ||  0;
            var toAdd = newValArrayLen - oldValArrayLen;
            for(var i = 0; i < toAdd; i++) {
                self.__listeners.push(new Listener(arrayPath + '[' + (oldValArrayLen + i).toString() + '].' + subPath, listenerFn));
            }
            var toRemove = oldValArrayLen - newValArrayLen;
            for(i = 0; i < toRemove; i++) {
                self._unlisten(arrayPath + '[' + (newValArrayLen + i).toString() + '].' + subPath);
            }
        }));
    } else {
        self.__listeners.push(new Listener(propertyPath, listenerFn));
    }
};

VM.prototype._unlisten = function (propertyPath) {
    for(var i = this.__listeners.length-1; i >= 0; i--) {
        if(this.__listeners[i].propertyPath.indexOf(propertyPath) === 0) {
            this.__listeners.splice(i, 1);    
        }
    }
};
VM.prototype._apply = function (fn) {
    try {
        return fn.call(this);
    } finally {
        this._applyChanges();
    }
};

VM.bindingHandlers = {
    "ez-text": function (self, propertyPath, element) {  // elementAccessor(idx) if within an array or elementAccessor(undefined)
        self._listen(propertyPath, function (newVal, oldValue, obj, objIdx) {
            var text = ('innerText' in element) ? 'innerText' : 'textContent';
            element[text] = newVal;
        });
    },
    "ez-html": function (self, propertyPath, element) {  
        self._listen(propertyPath, function (newVal, oldValue, obj, objIdx) {
            element.innerHTML = newVal;
        });
    },    
	"ez-value": function (self, propertyPath, element) { // for input & select
        self._listen(propertyPath, function (newVal) {
            if (element.selectedIndex !== undefined) {  // element is a 'select' element.
                // necessary for IE8 !!
                for(var i = 0; i < element.options.length; i++) {
                    if (element.options[i].value === newVal) {
                        element.selectedIndex = i;
                        return;
                    }
                }
            } else {
                element.value = newVal;
            }
        });
        element.addEventListener('change', function () {
            self._apply(function () {
                self._set(propertyPath, element.selectedIndex !== undefined ? element.options[element.selectedIndex].value /* for IE8 */ : element.value);
            });
        });
    },
	"ez-input": function (self, propertyPath, element) { // for input only (value updated on keypress)
        self._listen(propertyPath, function (newVal) {
            element.value = newVal;
        });
        element.addEventListener('keydown', function () {
            self._apply(function () {
                self._set(propertyPath, element.selectedIndex !== undefined ? element.options[element.selectedIndex].value /* for IE8 */ : element.value);
            });
        });
    },
    "ez-class": function (self, attrValue, element) {
        var params = attrValue.trim().split(/\s*\:\s*/);
        if (params.length !== 2) throw "ez-class format: <class-name>:<property-path>";
        self._listen(params[1], function (newVal) {
            if (element.classList) {
                if (newVal) {
                    element.classList.add(params[0]);
                } else {
                    element.classList.remove(params[0]);
                }
            } else {
                var classes = element.className.split(/\s+/);
                if (newVal) {
                    classes.push(params[0]);
                } else {
                    var i = classes.indexOf(params[0]);
                    if (i >= 0) classes.splice(i,1);
                }
                element.className = classes.join(' ');            
            }
        });
    },
    "ez-checked": function (self, propertyPath, element) {
        switch (element.type) {
            case "checkbox":
                self._listen(propertyPath, function (newVal) { element.checked = !!newVal; });
                element.addEventListener('change', function () {
                    self._apply(function () {
                        self._set(propertyPath, element.checked);
                    });
                });
                break;
            case "radio":
                self._listen(propertyPath, function (newVal) {  element.checked = element.value === newVal; });
                element.addEventListener('change', function () {
                    self._apply(function () {
                        self._set(propertyPath, element.checked ? element.value : undefined);
                    });
                });
                break;
        }
    },
    "ez-show": function (self, attrValue, element) {
        var oldVisibility = element.style.display;
        self._listen(attrValue, function (newVal) { element.style.display = newVal ? oldVisibility : "none";  });
    },
    "ez-style": function (self, attrValue, element) {
        var params = attrValue.trim().split(/\s*\:\s*/);
        if (params.length !== 2) throw "ez-style format: <style-name>:<property-path>";
        self._listen(params[1], function (newVal) { element.style[params[0]] = newVal; });
    },
    "ez-attr": function (self, attrValue, element) {
        var params = attrValue.trim().split(/\s*\:\s*/);
        if (params.length !== 2) throw "ez-attr format: <attr-name>:<property-path>";
        self._listen(params[1], function (newVal) {
            element.setAttribute(params[0], newVal);
        });
    },
    "ez-on": function (self, attrValue, element, arrayIndex) {  // format: ez-on="click:doit,focus:dothat"
        function addBinding (bindingDescr) {
           var params = bindingDescr.split(/\s*\:\s*/);
           if (params.length !== 2) throw "ez-on format: <event-name> : <func-to-call>";
           element.addEventListener(params[0], function (evt) {
               if (typeof self._get(params[1]) === 'function')  {
                   self._apply(function () {
                       self._get(params[1]).call(self, evt, arrayIndex);
                   });
               }
           });
        }
        var bindings = attrValue.trim().split(/\s*\,\s*/);
        for(var i = 0; i < bindings.length; i++) {
           addBinding((bindings[i]));
        }
    },
    "ez-repeat": function (self, propertyPath, element) {
        var parentElement = element.parentNode, templateElement = parentElement.removeChild(element);
        templateElement.removeAttribute("ez-repeat");
        self._listen(propertyPath, function arrayListenerHandler (newArrayLen, oldArrayLen) {
            oldArrayLen = oldArrayLen || 0;
            
            var toAdd = newArrayLen - oldArrayLen;
            for (var i = 0; i < toAdd; i++) {
                var newElement = templateElement.cloneNode(true); // true for deep clone
                parentElement.appendChild(newElement);
                self._bind(newElement, propertyPath + '[' + (oldArrayLen + i).toString() + '].');
            }
        
            var toRemove = oldArrayLen - newArrayLen;
            for (i = 0; i < toRemove; i++) {
                parentElement.removeChild(parentElement.lastChild);
                self._unlisten(propertyPath + '[' + (oldArrayLen + i).toString() + ']');
            }
            return true; // to stop binding of child elements !!
        });    
    }
};

VM.prototype._bind = function (element, propertyPathPrefix) {
    if (!element) return;
    
    // iterate over all 'ez-...' attributes
    for (var i = 0; i < element.attributes.length; i++) {
        var attr = element.attributes[i], attrName = attr.name.toLowerCase();
        if (VM.bindingHandlers[attrName] !== undefined) {
            var prefix = propertyPathPrefix || '',
                parts = attr.value.trim().split(/\s*\:\s*/),
                specifier = parts.length > 1 ? parts[0] : '',
                path = parts.length > 1 ? parts[1] : parts [0],
                newPath = prefix + path,
				matchIndex = /\[(\d+)\][^\[\]]*/.exec(propertyPathPrefix),
				arrayIndex = matchIndex !== null ? matchIndex[1] : undefined;
				
            newPath = newPath.replace(/\.\.\s*$/, '');  
            newPath = newPath.replace(/\w+\[\d+\]\.\s*\^/, ""); // interpret the go to parent character ^
            var attrValue = (specifier ? specifier + ':' : '') + newPath;
            var stopBinding = VM.bindingHandlers[attrName](this,  attrValue, element, arrayIndex);
            if (stopBinding) return; // stop binding the rest as it will parsed when adding new items to the array => see ez-repeat binding 
        } else {
            if (attrName.indexOf('ez-') === 0) {
                throw "unknown binding:" + attrName;
            }
        }
    }
    // iterate over children elements.
    for (i = 0; i < element.children.length; i++) {
        var child = element.children[i];
        this._bind(child, propertyPathPrefix);
    } 
};



/**
 * Send an AJAX request.
 *
 * @param {Object} options The options to use for the connection:
 *      - {string} url The URL to connect to.
 *      - {string} type The type of request, e.g. 'GET', or 'POST'.
 *      - {string} dataType The type of data expected, 'json'.
 *      - {string} contentType The content-type of the data.
 *      - {string|object} data The content to send.
 *      - {object} headers The headers to add to the HTTP request.
 *      - {function(XMLHttpRequest)} beforeSend A callback to call before sending.
 *      - {function({string|object}, {string}, {XMLHttpRequest})} success The success callback.
 *      - {function({XMLHttpRequest})} error The error callback.
 */
VM.ajax = function(options){
    options = options || {};
    var type = options.type || 'GET',
        url = options.url,
        contentType = options.contentType || 'application/json',
        data = options.data,
        headers = options.headers || {};

    // Data for GET and HEAD goes in the URL.
    if (type === 'GET' || type === 'HEAD') {
        url += (url.indexOf('?') === -1 ? '?' : '&') + (typeof data === 'object' ? toQueryString(data) : data);
        data = undefined;
    } else {
        if (typeof data === 'object') {
            data =  contentType === 'application/json' ? JSON.stringify(data) : toQueryString(data);
        }
    }

    var xhr = new XMLHttpRequest();
    xhr.open(type, url, true);

    xhr.setRequestHeader('Content-Type', contentType);
    for (var h in headers) {
        if (headers.hasOwnProperty(h)) {
            xhr.setRequestHeader(h, headers[h].toString());
        }
    }
    
    if (options.beforeSend) options.beforeSend(xhr);

    xhr.onload = function(){
        var error = false, content = xhr.responseText;

        // Parse the JSON before calling success.
        if (options.dataType === 'json'){
            try {
                content = JSON.parse(content);
            } catch (e) {
                error = true;
            }
        }

        if (!options.error || (!error && (xhr.status >= 200 && xhr.status < 300))){
            if (options.success) options.success(content, xhr.statusText, xhr);
        } else {
            options.error(xhr);
        }
    }.bind(this);

    xhr.onerror = xhr.onabort = function(){
        if (options.error) options.error(xhr);
    };

    xhr.send(data);

    return xhr;
};

var toQueryString = function (data) {
    var params = [];
    for(var prop in data) {
        if (data.hasOwnProperty(prop)) {
            params.push( encodeURIComponent(prop) + '=' + encodeURIComponent(data[prop]) );
        }
    }
    return params.join('&');
};

VM.prototype._getJsonP = function (url, dataOrFunc, func) {
    var self = this;
    var data = typeof(dataOrFunc) === 'object' ? dataOrFunc : {};
    data.callback = "callback_" + Math.floor((Math.random()*100000)+1);
    url += (url.indexOf('?') === -1 ? '?' : '&') + toQueryString(data);
    
    var head = document.getElementsByTagName('head')[0], 
        script = document.createElement('script');
    script.src = url; 
    script.type = 'text/javascript';
    
    window[data.callback] = function (content) {
        self._apply(function () {
            if (typeof (dataOrFunc) === 'function') { 
                dataOrFunc(content);
            } else {
                func(content);
            }
        });
        setTimeout(function () { 
            try { 
                delete window[data.callback];
            } catch (e) {
                window[data.callback] = undefined; 
            } 
            head.removeChild(script);  
        }, 0);
    };
    head.appendChild(script);
};

    
VM.prototype._getJson = function (url, dataOrFunc, func) {
    var self = this;
    var handler = function () {
        var f = typeof(dataOrFunc) === 'function' ? dataOrFunc : func, 
            args = arguments;
        self._apply(function () {
            f.apply(self, args);
        });
    };
    VM.ajax({
        url: url,
        type: 'GET',
        dataType: 'json',
        data: typeof(dataOrFunc) === 'function' ? {} : dataOrFunc,
        success: handler
    });
};

VM.prototype._postJson = function (url, dataOrFunc, func) {
    var self = this;
    var handler = function () {
        var f = typeof(dataOrFunc) === 'function' ? dataOrFunc : func, 
            args = arguments;
        self._apply(function () {
            f.apply(self, args);
        });
    };
    VM.ajax({
        url: url,
        type: 'POST',
        dataType: 'json',
        data: typeof(dataOrFunc) === 'function' ? {} : dataOrFunc,
        success: handler
    });
};
   
/**
    Define the AMD compatible module.
*/
if ( typeof define === "function" && define.amd ) {
    define( "ez-bind", [], function() {
        return VM;
    });
} else {
    window.EZ = VM;
}

})();

