
    var Mexp=require('./lexer.js');

	Mexp.prototype.toPostfix = function () {
		'use strict';
		var post=[],elem,popped,prep,pre,ele;
    	var stack=[{value:"(",type:4,pre:0}];
		var arr=this.value;
		for (var i=1; i < arr.length; i++) {
			if(arr[i].type===1||arr[i].type===3||arr[i].type===13){	//if token is number,constant,or n(which is also a special constant in our case)
				if(arr[i].type===1)
					arr[i].value=Number(arr[i].value);
				post.push(arr[i]);
			}
			else if(arr[i].type===4){
				stack.push(arr[i]);
			}
			else if(arr[i].type===5){
				while((popped=stack.pop()).type!==4){
					post.push(popped);
				}
			}
			else if(arr[i].type===11){
				while((popped=stack.pop()).type!==4){
					post.push(popped);
				}
				stack.push(popped);
			}
			else {
				elem=arr[i];
				pre=elem.pre;
				ele=stack[stack.length-1];
				prep=ele.pre;
				var flag=ele.value=='Math.pow'&&elem.value=='Math.pow';
				if(pre>prep)stack.push(elem);
				else {
					while(prep>=pre&&!flag||flag&&pre<prep){
						popped=stack.pop();
						ele=stack[stack.length-1];
						post.push(popped);
						prep=ele.pre;
						flag=elem.value=='Math.pow'&&ele.value=='Math.pow';
					}
					stack.push(elem);
				}
			}
		}
		return new Mexp(post);
	};
    module.exports=Mexp;