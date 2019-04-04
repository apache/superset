/** math-expression-evaluator version 1.2.17
 Dated:2017-04-28 */

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.mexp = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Mexp=require('./postfix_evaluator.js');
Mexp.prototype.formulaEval = function () {
	"use strict";
	var stack=[],pop1,pop2,pop3;
	var disp=[];
	var temp='';
	var arr=this.value;
	for(var i=0;i<arr.length;i++){
		if(arr[i].type===1||arr[i].type===3){
			disp.push({value:arr[i].type===3?arr[i].show:arr[i].value,type:1});
		}
		else if(arr[i].type===13){
			disp.push({value:arr[i].show,type:1});
		}
		else if(arr[i].type===0){
			disp[disp.length-1]={value:arr[i].show+(arr[i].show!="-"?"(":"")+disp[disp.length-1].value+(arr[i].show!="-"?")":""),type:0};
		}
		else if(arr[i].type===7){
			disp[disp.length-1]={value:(disp[disp.length-1].type!=1?"(":"")+disp[disp.length-1].value+(disp[disp.length-1].type!=1?")":"")+arr[i].show,type:7};
		}
		else if(arr[i].type===10){
			pop1=disp.pop();
			pop2=disp.pop();
			if(arr[i].show==='P'||arr[i].show==='C')disp.push({value:"<sup>"+pop2.value+"</sup>"+arr[i].show+"<sub>"+pop1.value+"</sub>",type:10});
			else disp.push({value:(pop2.type!=1?"(":"")+pop2.value+(pop2.type!=1?")":"")+"<sup>"+pop1.value+"</sup>",type:1});
		}
		else if(arr[i].type===2||arr[i].type===9){
			pop1=disp.pop();
			pop2=disp.pop();
			disp.push({value:(pop2.type!=1?"(":"")+pop2.value+(pop2.type!=1?")":"")+arr[i].show+(pop1.type!=1?"(":"")+pop1.value+(pop1.type!=1?")":""),type:arr[i].type});
		}
		else if(arr[i].type===12){
			pop1=disp.pop();
			pop2=disp.pop();
			pop3=disp.pop();
			disp.push({value:arr[i].show+"("+pop3.value+","+pop2.value+","+pop1.value+")",type:12});
		}
	}
	return disp[0].value;
};
module.exports=Mexp;
},{"./postfix_evaluator.js":5}],2:[function(require,module,exports){
var Mexp=require('./math_function.js');
	function inc(arr,val){
		for(var i=0;i<arr.length;i++)
			arr[i]+=val;
		return arr;
	}
	var token=['sin','cos','tan','pi','(',')','P','C',
		  'asin','acos','atan','7','8','9','int',
		  'cosh','acosh','ln','^','root','4','5','6','/','!',
		  'tanh','atanh','Mod','1','2','3','*',
		  'sinh','asinh','e','log','0','.','+','-',',','Sigma','n','Pi','pow'];
	var show=['sin','cos','tan','&pi;','(',')','P','C',
		'asin','acos','atan','7','8','9','Int',
		'cosh','acosh',' ln','^','root','4','5','6','&divide;','!',
		'tanh','atanh',' Mod ','1','2','3','&times;',
		'sinh','asinh','e',' log','0','.','+','-',',','&Sigma;','n','&Pi;','pow'];
	var eva=[Mexp.math.sin,Mexp.math.cos,Mexp.math.tan,'PI','(',')',Mexp.math.P,Mexp.math.C,
		Mexp.math.asin,Mexp.math.acos,Mexp.math.atan,'7','8','9',Math.floor,
		Mexp.math.cosh,Mexp.math.acosh,Math.log,Math.pow,Math.sqrt,'4','5','6',Mexp.math.div,Mexp.math.fact,
		Mexp.math.tanh,Mexp.math.atanh,Mexp.math.mod,'1','2','3',Mexp.math.mul,
		Mexp.math.sinh,Mexp.math.asinh,'E',Mexp.math.log,'0','.',Mexp.math.add,Mexp.math.sub,',',Mexp.math.sigma,'n',Mexp.math.Pi,Math.pow];
	var preced={0:11,1:0,2:3,3:0,4:0,5:0,6:0,7:11,8:11,9:1,10:10,11:0,12:11,13:0};
	var type=[0,0,0,3,4,5,10,10,
		0,0,0,1,1,1,0,
		0,0,0,10,0,1,1,1,2,7,
		0,0,2,1,1,1,2,
		0,0,3,0,1,6,9,9,11,12,13,12,8];
	 /*
	0 : function with syntax function_name(Maths_exp)
	1 : numbers
	2 : binary operators like * / Mod left associate and same precedence
	3 : Math constant values like e,pi,Cruncher ans
	4 : opening bracket
	5 : closing bracket
	6 : decimal
	7 : function with syntax (Math_exp)function_name
	8: function with syntax function_name(Math_exp1,Math_exp2)
	9 : binary operator like +,-
	10: binary operator like P C or ^
	11: ,
	12: function with , seperated three parameters
	13: variable of Sigma function
	 */
	var type0={0:true,1:true,3:true,4:true,6:true,8:true,9:true,12:true,13:true},//type2:true,type4:true,type9:true,type11:true,type21:true,type22
	type1={0:true,1:true,2:true,3:true,4:true,5:true,6:true,7:true,8:true,9:true,10:true,11:true,12:true,13:true},//type3:true,type5:true,type7:true,type23
	type_1={0:true,3:true,4:true,8:true,12:true,13:true},
	empty={},
	type_3={0:true,1:true,3:true,4:true,6:true,8:true,12:true,13:true},//type_5:true,type_7:true,type_23
	type6={1:true},
	newAr=[[],
			["1","2","3","7","8","9","4","5","6","+","-","*","/","(",")","^","!","P","C","e","0",".",",","n"],
			["pi","ln","Pi"],
			["sin","cos","tan","Del","int","Mod","log","pow"],
			["asin","acos","atan","cosh","root","tanh","sinh"],
			["acosh","atanh","asinh","Sigma"]];
	function match(str1,str2,i,x){
		for(var f=0;f<x;f++){
			if (str1[i+f]!==str2[f])
				return false;
		}
		return true;
	}
	Mexp.addToken=function(tokens){
		for(i=0;i<tokens.length;i++){
			x=tokens[i].token.length;
			var temp=-1;

			//newAr is a specially designed data structure in which 1D array at location one of 2d array has all string with length 1 2 with 2 and so on

			if (x<newAr.length)	//match to check if token is really huge and not existing
								//if not checked it will break in next line as undefined index
				for(y=0;y<newAr[x].length;y++){
					if (tokens[i].token===newAr[x][y]){
						temp=token.indexOf(newAr[x][y]);
						break;
					}
				}
			if (temp===-1) {
				token.push(tokens[i].token);
				type.push(tokens[i].type);
				if(newAr.length<=tokens[i].token.length)
					newAr[tokens[i].token.length]=[];
				newAr[tokens[i].token.length].push(tokens[i].token);
				eva.push(tokens[i].value);
				show.push(tokens[i].show);
			}
			else {
				token[temp]=tokens[i].token;
				type[temp]=tokens[i].type;
				eva[temp]=tokens[i].value;
				show[temp]=tokens[i].show;
			}
		}
	};
	Mexp.lex=function(inp,tokens){
		'use strict';
		var str=[{type:4,value:"(",show:"(",pre:0}];
		var ptc=[];	//Parenthesis to close at the beginning is after one token
		var inpStr=inp;
		var key;
        var pcounter=0;
		var allowed=type0;
		var bracToClose=0;
		var asterick=empty;
		var prevKey='';
		var i,x,y;
		if(typeof tokens!=="undefined")
			Mexp.addToken(tokens);
		var obj={};
		for(i=0;i<inpStr.length;i++){
			if (inpStr[i]==' ') {
				continue;
			}
			key='';
			sec:for(x=(inpStr.length-i>(newAr.length-2)?newAr.length-1:inpStr.length-i);x>0;x--){
				for(y=0;y<newAr[x].length;y++){
					if (match(inpStr,newAr[x][y],i,x)){
						key=newAr[x][y];
						break sec;
					}
				}
			}
			i+=key.length-1;
			if(key===''){
				throw(new Mexp.exception("Can't understand after "+inpStr.slice(i)));
			}
			var index=token.indexOf(key);
			var cToken=key;
			var cType=type[index];
			var cEv=eva[index];
			var cPre=preced[cType];
			var	cShow=show[index];
			var pre=str[str.length-1];
			for(j=ptc.length;j--;){	//loop over ptc
				if(ptc[j]===0){
					if([0,2,3,5,9,11,12,13].indexOf(cType)!==-1){
						if(allowed[cType]!==true){
							throw(new Mexp.exception(key+" is not allowed after "+prevKey));
						}
						str.push({value:")",type:5,pre:0,show:")"});
						allowed=type1;
						asterick=type_3;
						inc(ptc,-1).pop();
					}
				}
			}
			if(allowed[cType]!==true){
				throw(new Mexp.exception(key+" is not allowed after "+prevKey));
			}
			if(asterick[cType]===true){
				cType=2;
				cEv=Mexp.math.mul;
				cShow="&times;";
				cPre=3;
				i=i-key.length;
		 	}
			obj={value:cEv,type:cType,pre:cPre,show:cShow};
			if(cType===0){
				allowed=type0;
				asterick=empty;
				inc(ptc,2).push(2);
				str.push(obj);
				str.push({value:"(",type:4,pre:0,show:"("});
			}
			else if(cType===1){
				if(pre.type===1){
					pre.value+=cEv;
					inc(ptc,1);
				}
				else {
					str.push(obj);
				}
				allowed=type1;
				asterick=type_1;
			}
			else if(cType===2){
				allowed=type0;
				asterick=empty;
				inc(ptc,2);
				str.push(obj);
			}
			else if(cType===3){//constant
				str.push(obj);
				allowed=type1;
				asterick=type_3;
			}
			else if(cType===4){
                pcounter+=ptc.length;
                ptc=[];
				bracToClose++;
				allowed=type0;
				asterick=empty;
				str.push(obj);
			}
			else if(cType===5){
				if(!bracToClose){
					throw(new Mexp.exception("Closing parenthesis are more than opening one, wait What!!!"));
				}
                while(pcounter--){	//loop over ptc
    						str.push({value:")",type:5,pre:0,show:")"});
    			}
                pcounter=0;
				bracToClose--;
				allowed=type1;
				asterick=type_3;
				str.push(obj);
			}
			else if(cType===6){
				if(pre.hasDec){
					throw(new Mexp.exception("Two decimals are not allowed in one number"));
				}
				if(pre.type!==1){
					pre={value:0,type:1,pre:0};	//pre needs to be changed as it will the last value now to be safe in later code
					str.push(pre);
					inc(ptc,-1);
				}
				allowed=type6;
				inc(ptc,1);
				asterick=empty;
				pre.value+=cEv;
				pre.hasDec=true;
			}
			else if(cType===7){
				allowed=type1;
				asterick=type_3;
				inc(ptc,1);
				str.push(obj);
			}
			if(cType===8){
				allowed=type0;
				asterick=empty;
				inc(ptc,4).push(4);
				str.push(obj);
				str.push({value:"(",type:4,pre:0,show:"("});
			}
			else if(cType===9){
				if(pre.type===9){
					if(pre.value===Mexp.math.add){
						pre.value=cEv;
						pre.show=cShow;
						inc(ptc,1);
					}
					else if(pre.value===Mexp.math.sub&&cShow==='-'){
						pre.value=Mexp.math.add;
						pre.show='+';
						inc(ptc,1);
					}
				}
				else if(pre.type!==5&&pre.type!==7&&pre.type!==1&&pre.type!==3&&pre.type!==13){//changesign only when negative is found
					if(cToken==='-'){//do nothing for + token
									//don't add with the above if statement as that will run the else statement of parent if on Ctoken +
						allowed=type0;
						asterick=empty;
						inc(ptc,2).push(2);
						str.push({value:Mexp.math.changeSign,type:0,pre:21,show:"-"});
						str.push({value:"(",type:4,pre:0,show:"("});
					}
				}
				else{
					str.push(obj);
					inc(ptc,2);
				}
				allowed=type0;
				asterick=empty;
			}
			else if(cType===10){
				allowed=type0;
				asterick=empty;
				inc(ptc,2);
				str.push(obj);
			}
			else if(cType===11){
				allowed=type0;
				asterick=empty;
				str.push(obj);
			}
			else if(cType===12){
				allowed=type0;
				asterick=empty;
				inc(ptc,6).push(6);
				str.push(obj);
				str.push({value:"(",type:4,pre:0});
			}
			else if(cType===13){
				allowed=type1;
				asterick=type_3;
				str.push(obj);
			}
			inc(ptc,-1);
			prevKey=key;
		}
		for(var j=ptc.length;j--;){	//loop over ptc
			if(ptc[j]===0){

				str.push({value:")",show:")",type:5,pre:3});
				inc(ptc,-1).pop();
			}
		}
		if (allowed[5]!==true) {
			throw(new Mexp.exception("complete the expression"));
		}
		while(bracToClose--)
			str.push({value:")",show:")",type:5,pre:3});

		str.push({type:5,value:")",show:")",pre:0});
//        console.log(str);
		return new Mexp(str);
	};
    module.exports=Mexp;

},{"./math_function.js":3}],3:[function(require,module,exports){
	var Mexp=function(parsed){
		this.value=parsed;

	};

	Mexp.math={
		isDegree:true, //mode of calculator
		acos:function(x){
			return (Mexp.math.isDegree?180/Math.PI*Math.acos(x):Math.acos(x));
		},
		add:function(a,b){
			return a+b;
		},
		asin:function(x){
			return (Mexp.math.isDegree?180/Math.PI*Math.asin(x):Math.asin(x));
		},
		atan:function(x){
			return (Mexp.math.isDegree?180/Math.PI*Math.atan(x):Math.atan(x));
		},
		acosh:function(x){
			return Math.log(x+Math.sqrt(x*x-1));
		},
		asinh:function(x){
			return Math.log(x+Math.sqrt(x*x+1));
		},
		atanh:function(x){
			return Math.log((1+x)/(1-x));
		},
		C:function(n,r){
			var pro=1,other=n-r,choice=r;
			if(choice<other){
			choice=other;
			other=r;
			}
			for(var i=choice+1;i<=n;i++)
				pro*=i;
			return pro/Mexp.math.fact(other);
		},
		changeSign:function(x){
			return -x;
		},
		cos:function(x){
			if(Mexp.math.isDegree)x=Mexp.math.toRadian(x);
			return Math.cos(x);
		},
		cosh:function(x){
			return (Math.pow(Math.E,x)+Math.pow(Math.E,-1*x))/2;
		},
		div:function(a,b){
		return a/b;
		},
		fact:function(n) {
		if(n%1!==0)return "NAN";
			var pro=1;
			for(var i=2;i<=n;i++)
				pro*=i;
			return pro;
		},
		inverse:function(x){
			return 1/x;
		},
		log:function(i){
			return Math.log(i)/Math.log(10);
		},
		mod:function(a,b){
		return a%b;
		},
		mul:function(a,b){
		return a*b;
		},
		P:function(n,r){var pro=1;
			 for(var i=Math.floor(n)-Math.floor(r)+1;i<=Math.floor(n);i++)
					pro*=i;
					return pro;

		},
		Pi:function(low,high,ex){
			var pro=1;
			for(var i=low;i<=high;i++){
				pro*=Number(ex.postfixEval({n:i}));
			}
			return pro;
		},
		pow10x:function(e){
			var x=1;
			while(e--){x*=10;}
			return x;
		},
		sigma:function(low,high,ex){
			var sum=0;
			for(var i=low;i<=high;i++){
				sum+=Number(ex.postfixEval({n:i}));
			}
			return sum;
		},
		sin:function(x){
			if(Mexp.math.isDegree)x=Mexp.math.toRadian(x);
			return Math.sin(x);
		},
		sinh:function(x){
			return (Math.pow(Math.E,x)-Math.pow(Math.E,-1*x))/2;
		},
		sub:function(a,b){
		return a-b;
		},
		tan:function(x){
			if(Mexp.math.isDegree)x=Mexp.math.toRadian(x);
			return Math.tan(x);
		},
		tanh:function(x){
			return Mexp.sinha(x)/Mexp.cosha(x);
		},
		toRadian:function(x){
			return x*Math.PI/180;
		}
	};
	Mexp.exception=function(message){
		this.message=message;
	};
    module.exports=Mexp;
},{}],4:[function(require,module,exports){

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
},{"./lexer.js":2}],5:[function(require,module,exports){
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
},{"./postfix.js":4}]},{},[1])(1)
});