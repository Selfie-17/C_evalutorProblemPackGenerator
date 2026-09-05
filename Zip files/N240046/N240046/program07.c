#include <stdio.h>
//program to swap two numbers without using third variable
int main(){
    int a,b;
    printf("enter two numbers:");
    scanf("%d",&a);
    scanf("%d",&b);
    a=a+b;
    b=a-b;
    a=a-b;
    printf("after swapping:\n");
    printf("a=%d\nb=%d",a,b);
    return 0;
}