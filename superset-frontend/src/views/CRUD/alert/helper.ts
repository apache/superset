/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

export const findMinValue = (arr:any) => {
  let minValue = arr[0]; // Assume the first value is the smallest
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < minValue) {
      minValue = arr[i];
    }
  }
  return minValue;
}

export const getRangeTimeout = (minPart:string) => {
  let minArray = []
  if(minPart.includes(",")){
    minArray = minPart.split(",");
  }
  else{
    minArray.push(minPart)
    console.log(typeof(minArray))
  }
  let stepperArray = []
  let commaSeparatedArray = []
  let minValue = Math.min()
  for(let i=0;i<minArray.length;i++){
    if(minArray[i].includes("-")){
      if(minArray[i].includes("/")){
        let stepper = minArray[i].split("/").pop()
        console.log("stepper in for loop",stepper)
        stepperArray.push(Number(stepper))
      }
      else{
        stepperArray.push(1)
      }
    }
    else{
      commaSeparatedArray.push(minArray[i])
    }
  }
    if(commaSeparatedArray.length > 0){
      for(let i=0;i<commaSeparatedArray.length;i++){
        let currValue = Number(commaSeparatedArray[i])
     if(currValue !== 0){
         let currDiff = currValue - Number(commaSeparatedArray[i-1] || 0)
      if(currDiff < minValue){
        minValue = currDiff
      }
    }
 }
    stepperArray.push(minValue)
 }
  return findMinValue(stepperArray)
}


export const getLeastTimeout = (minPart:string,defaultWorkingTimeout:number) => {
  if(minPart === "*"){
  return 60
}
else if(minPart == "0"){
  return 3600
}
else if(minPart.includes(",") || minPart.includes("-")){
  let timeout = getRangeTimeout(minPart)
  return timeout * 60
}
  else{
    return defaultWorkingTimeout
  }
}