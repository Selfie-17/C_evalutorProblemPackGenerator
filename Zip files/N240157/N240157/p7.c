//write a program to swap two given numbers without using an extra variable
#include<stdio.h>
int main(){
    int a,b;
    printf("enter the two numbers=");
    scanf("%d %d",&a,&b);
    a=a+b;
    b=a-b;
    a=a-b;
    printf("a=%d",a);
    printf("b=%d",b);
    return 0;
}