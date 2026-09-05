//Swapping two numbers using temporary variable
#include<stdio.h>
int main(){
    int a,b,c;
    printf("Enter two numbers:");
    scanf("%d%d",&a,&b);
    c=a;
    a=b;
    b=c;
    printf("After swapping\n");
    printf("a=%d\n",a);
    printf("b=%d\n",b);
    return 0;

}