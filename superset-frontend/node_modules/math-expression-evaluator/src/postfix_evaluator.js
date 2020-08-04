var Mexp=require('./postfix.js');
Mexp.prototype.postfixEval = function (UserDefined) {
	'use strict';
	UserDefined=UserDefined||{};
	UserDefined.PI=Math.PI;
	UserDefined.E=Math.E;
	var stack=[],pop1,pop2,pop3;
	var disp=[];
	var temp='';
	var arr=this.value;
	var bool=(typeof UserDefined.n!=="undefined");
	for(var i=0;i<arr.length;i++){
		if(arr[i].type===1){
			stack.push({value:arr[i].value,type:1});
		}
		else if(arr[i].type===3){
			stack.push({value:UserDefined[arr[i].value],type:1});
		}
		else if(arr[i].type===0){
			if(typeof stack[stack.length-1].type==="undefined"){
				stack[stack.length-1].value.push(arr[i]);
			}
			else stack[stack.length-1].value=arr[i].value(stack[stack.length-1].value);
		}
		else if(arr[i].type===7){
			if(typeof stack[stack.length-1].type==="undefined"){
				stack[stack.length-1].value.push(arr[i]);
			}
			else stack[stack.length-1].value=arr[i].value(stack[stack.length-1].value);
		}
		else if(arr[i].type===8){
			pop1=stack.pop();
			pop2=stack.pop();
			stack.push({type:1,value:arr[i].value(pop2.value,pop1.value)});
		}
		else if(arr[i].type===10){
			pop1=stack.pop();
			pop2=stack.pop();
			if(typeof pop2.type==="undefined"){
				pop2.value=pop2.concat(pop1);
				pop2.value.push(arr[i]);
				stack.push(pop2);
			}
			else if (typeof pop1.type==="undefined") {
				pop1.unshift(pop2);
				pop1.push(arr[i]);
				stack.push(pop1);
			}
			else{
				stack.push({type:1,value:arr[i].value(pop2.value,pop1.value)});
            }
		}
		else if(arr[i].type===2||arr[i].type===9){
			pop1=stack.pop();
			pop2=stack.pop();
			if(typeof pop2.type==="undefined"){
                console.log(pop2);
				pop2=pop2.concat(pop1);
				pop2.push(arr[i]);
				stack.push(pop2);
			}
			else if (typeof pop1.type==="undefined") {
				pop1.unshift(pop2);
				pop1.push(arr[i]);
				stack.push(pop1);
			}
			else{
				stack.push({type:1,value:arr[i].value(pop2.value,pop1.value)});
			}
		}
		else if(arr[i].type===12){
			pop1=stack.pop();
			if (typeof pop1.type!=="undefined") {
				pop1=[pop1];
			}
			pop2=stack.pop();
			pop3=stack.pop();
			stack.push({type:1,value:arr[i].value(pop3.value,pop2.value,new Mexp(pop1))});
		}
		else if(arr[i].type===13){
			if(bool){
				stack.push({value:UserDefined[arr[i].value],type:3});
			}
			else stack.push([arr[i]]);
		}
	}
	if (stack.length>1) {
		throw(new Mexp.exception("Uncaught Syntax error"));
	}
	return stack[0].value>1000000000000000?"Infinity":parseFloat(stack[0].value.toFixed(15));
};
Mexp.eval=function(str,tokens,obj){
	if (typeof tokens==="undefined") {
		return this.lex(str).toPostfix().postfixEval();
	}
	else if (typeof obj==="undefined") {
		if (typeof tokens.length!=="undefined") 
			return this.lex(str,tokens).toPostfix().postfixEval();
		else
			return this.lex(str).toPostfix().postfixEval(tokens);
	}
	else
		return this.lex(str,tokens).toPostfix().postfixEval(obj);
};
module.exports=Mexp;