#include<stdio.h>
//program to check whether given number is evn or odd
int main(){
    int num;
    printf("enter a number:");
    scanf("%d",&num);
    if(num%2==0){
        printf("%d is a even number.",num);
    
    }
    else{
        printf("the given number is odd number.");
    }
    return 0;

}