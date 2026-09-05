#include<stdio.h>
//program to check whether it is leap year or not.
int main(){
    int year;
    printf("enter year:");
    scanf("%d",&year);
    if(year%400==0){
        printf("%d is a leap year",year);
    }
    else if(year%4==0&&year%100!=0){
        printf("%d is a leap year",year);   
    }
    else{
        printf("%d is not a leap year",year);
    }
    return 0;
}