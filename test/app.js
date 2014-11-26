/* global EZ,document,console */


var vm = new EZ();
vm._bind(document.documentElement);

vm.repl = function (text) {
	var re = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
	return text.replace(re,"<a target='_blank' href='$1'>$1</a>"); 
};

vm._listen('count', function (nv) {
    vm.list = [];
    for(var i = 0; i < nv; i++) {
       vm.list.push({value: i, text: "aaa"});
    }
});

vm.add = function () {
    vm.list.push({value: 99, text: "new"});    
};

vm._apply(function () {
	vm.count = 5;
	vm.data1 = "coucou"; 
	//vm.flag = true;
	vm.list2 = ["aaa", "bbb", "ccc"];
});

vm._listen('tweets.statuses[*].text', function (nv, ov, item) {
	item.html = vm.repl(nv);
});

vm._getJsonP('http://gbs.eu01.aws.af.cm/tweets', function (obj) {
	vm.tweets = obj;
});

vm.flag = false;
vm.show = false;
vm.show2 = false;

vm.remove = function (idx) {
	vm.list.splice(idx,1);
};

vm.showBtn = false;
vm._listen('list[*].flag', function () {
	var result = false;
	for(var i = 0; i < vm.list.length; i++) {
		if (vm.list[i].flag) {
			result = true;
		}
	}
	vm.showBtn = result;
});


vm._listen('list', function () {
   vm.count = vm.list.length;
});

vm.removeSelected = function () {
	for (var i = vm.list.length-1; i >= 0; i--) {
		if (vm.list[i].flag) {
			vm.list.splice(i,1);
		}
	}
};

vm._applyChanges();


