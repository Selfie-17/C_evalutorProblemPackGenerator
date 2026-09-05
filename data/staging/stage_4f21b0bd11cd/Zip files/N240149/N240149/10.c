#include<stdio.h>
int main(){
    int marks;
    printf("Enter marks:");
    scanf("%d",&marks);
    if(marks>=90&&marks<=100){
        printf("Grade is A");

    }
    else if(marks>=80&&marks<=90){
        printf("Grade is B");

    }
    else if(marks>=70&&marks<=80){
        printf("Grade is C");
    }
    else if(marks>=60&&marks<=70){
        printf("Grade is D");
    }
    else if(marks>=50&&marks<=60){
        printf("Grade is E");
    }
    else{
        printf("You are failed");
    }
    return 0;
}