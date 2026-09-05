#include<stdio.h>
//program to find the largest of three numbers using ternary operators.
int main(){ 
    int a,b,c,largest;
    printf("enter three numbers:");
    scanf("%d%d%d",&a,&b,&c);
    largest=(a>b)?((a>c)?a:c):((b>c)?b:c);
    printf("largest=%d",largest);

    return 0;
}
