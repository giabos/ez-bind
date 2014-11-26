/* global module,test,EZ,equal,deepEqual,document,$,console */



module( "module", {
	setup: function() {
		
	}, teardown: function() {
		
	}
});


// http://stackoverflow.com/questions/2856513/how-can-i-trigger-an-onchange-event-manually
$.fn.triggerChange = function () {  
    var element = $(this).get(0), evt;
	if ($.browser.msie && parseInt($.browser.version, 10) <= 8) { 
		if (element.type !== 'radio') {
			evt = document.createEventObject();
			element.fireEvent('onchange', evt); // IE8 (does not work for radio button).
		}
	} else {
		evt = document.createEvent("HTMLEvents");
		evt.initEvent("change", false, true);
		element.dispatchEvent(evt);
	}
};

test("listen simple item", function () {
	var vm = new EZ(), newValue;
	vm._listen('count', function (nv, old) { newValue = nv; }); 
	vm._apply(function () {  vm.count = 2; });
	equal( newValue, 2);
});

test("listen array item", function () {
	var vm = new EZ(), newVal, oldVal;
	vm.list = [{count: 4}];
	vm._listen('list[0].count', function (nv, old) { newVal = nv; oldVal = old; }); 
	vm._apply(function () {  vm.list[0].count = 2;  });
	equal(newVal, 2);
	equal(oldVal, undefined);
	vm._apply(function () {  vm.list[0].count = 11;  });
	equal(newVal, 11);
	equal(oldVal, 2);
});

test("listen on all items of a array", function () {
	var vm = new EZ();
	vm.list = [{data: 4}, {data: 5}, {data: 6}];
	var newVal = [], oldVal = [], count = 0;
	vm._listen('list[*].data', function (nv, old) { newVal.push(nv); oldVal.push(old); count++; });

	
	vm._apply(function () { vm.list[1].data = 55; });
	equal(count, 3, "listener function should be called 3 times, for each item in array as everything is new");
	deepEqual(newVal, [4,55,6]);
	deepEqual(oldVal, [undefined, undefined, undefined], "no value previously");
	
	newVal = []; oldVal = []; count = 0;
	vm._apply(function () { vm.list[0].data = 44;   vm.list[2].data = 66;  });
	equal(count, 2);
	deepEqual(newVal, [44, 66]);
	deepEqual(oldVal, [4, 6]);
});

test("'ez-text' binding", function () {
	var vm = new EZ();
	vm._bind(document.getElementById("T1"));
	
	vm._apply(function () {
		vm.data = "aa";
	});
	
	equal($('#T1 span').text(), "aa", "text span changed to aa");
	
	vm._apply(function () {
		vm.data = "bb";
	});
	
	equal($('#T1 span').text(), "bb", "text span changed to bb");	
});

test("'ez-value' binding", function () {
	var vm = new EZ();
	vm._bind(document.getElementById('T2'));
	
	vm._apply(function () {
		vm.data = "aa";
	});
	equal($('#T2 span').text(), "aa", "change of model implies change of text");
	equal($('#T2 input').val(), "aa", "change of model implies change of input value");
    
    $('#T2 input').val("bb").triggerChange();  // !! val() does not trigger a 'change' event automatically.
    
	equal(vm.data, "bb", "change of input value implies change model");
	equal($('#T2 span').text(), "bb", "text changed as well");
});

test("'ez-event' binding", function () {
	var vm = new EZ();
	vm._bind(document.getElementById("T3"));
	
	vm.change = function () { vm.data = "changed";  };
	
	vm._apply(function () {
		vm.data = "aa";
	});

	$('#T3 button').trigger('click');
	
	equal($('#T3 span').text(), "changed", "text span changed to 'changed'");
	equal($('#T3 input').val(), "changed", "value input changed to 'changed'");
});

test("ez-repeat 1", function () {
	var vm = new EZ();
	vm._bind(document.getElementById("T4"));
    vm.list = [];

	vm._apply(function () {
		vm.list.push( {data: "aaa"} );
		vm.list.push( {data: "bbb"} );
		vm.list.push( {data: "ccc"} );
		vm.list.push( {data: "ddd"} );
	});

	equal($('#T4 ul li').size(), 4);
    equal($('#T4 ul li:last span').text(), "ddd");
});

test("go to parent", function () {
	var vm = new EZ(document.getElementById("T5"));
    vm.list = [];
	vm.value = undefined;
	
	vm._apply(function () {
		vm.list.push( 1 );
		vm.list.push( 2 );
		vm.list.push( 3 );
		vm.list.push( 4 );
	});

	$('input:radio[name=selection]:nth(2)').attr('checked',true).triggerChange();

	equal($('#T5 input').val(), 3);
});

asyncTest("jsonp", function () {
	expect(2);
	var vm = new EZ(document.getElementById("T6"));
	vm._getJsonP('http://echo.jsontest.com/k1/v1/k2/v2', function (resp) {
		vm.resp = resp;
	});
	setTimeout(function() {
		equal($('#T6 span:nth(0)').text(), 'v1');
		equal($('#T6 span:nth(1)').text(), 'v2');
		start();
	}, 2000);
	
});



