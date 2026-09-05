//2.To check whether it is positive,negative or zero
#include<stdio.h>
int main(){
    int num;
    printf("Enter a number:");
    scanf("%d",&num);
    if(num>0){
        printf("It is a positive number");
    }
    else if(num<0){
        printf("It is a negative number");
    }
    else{
    printf("It is zero");
    }
    return 0;
}