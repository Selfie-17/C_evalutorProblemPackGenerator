#include<stdio.h>
//program to swap two numbers using temporary variable.
int main(){
    int a,b,temp;
    printf("enter two numbers:");
    scanf("%d%d",&a,&b);
    temp=a;
    a=b;
    b=temp;
    printf("After swapping:\n");
    printf("a=%d\nb=%d",a,b);

    return 0;
}