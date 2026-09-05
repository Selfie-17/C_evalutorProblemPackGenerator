//swap using third variable

#include<stdio.h>
int main()
{
    int temp,a,b;
    printf("enter two values");
    scanf("%d %d",&a,&b);

    temp=a;
    a=b;
    b=temp;
    printf("a=%d \n b=%d",a,b);
}