// var isStudent = true;
// console.log(isStudent);
// isStudent = "krishnam";
// console.log(isStudent);

// function greetName(name){
//     return (
//         "hello "+ name
//     );
// }

// let hi = greetName("aman");
// console.log(hi);

// let message = (firstName)=>{
//     return (
//         "hello "+ firstName
//     );
// }

// console.log(message("krishnam"));

// let sum = (a,b)=>{
//     return(
//         a + b
//     );
// }

// console.log(sum(2,5));

let canVote = (age)=>{
    
    if(age>18){
        return true;
    }
    else{
        return false;
    }
    
}

let yesNo = canVote(13);
console.log(yesNo);