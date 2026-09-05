//write a program to swap two given numbers  using a temporary variable.
#include<stdio.h>
int main(){
    int a,b,temp;
    printf("enter the two numbers=");
    scanf("%d %d",&a,&b);
    printf("before swapping---\n");
    printf("a=%d\n",a);
    printf("b=%d\n",b);
    temp=a;
    a=b;
    b=temp;
    printf("after swapping--\n");
    printf("a=%d\n",a);
    printf("b=%d\n",b);
    return 0;
}