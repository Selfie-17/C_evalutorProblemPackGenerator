#include<stdio.h>
//program to find whether the given  number is positive , negative or zero.
int main(){
    int num;
    printf("enter a number:");
    scanf("%d",&num);
    if(num<0){
        printf("%d is negative.",num);
    }
    else if(num>0){
        printf("%d is positive.",num); 
    }
    else{
        printf("the  given number is zero.");
    }
    return 0;

}