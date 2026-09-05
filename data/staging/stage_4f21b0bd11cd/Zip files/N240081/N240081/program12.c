//largest num among three numbers
#include<stdio.h>
int main()
{
    int a,b,c,largest;
    printf("enter three numbers:");
    scanf("%d %d %d",&a,&b,&c);
     
    largest=(a>b)?((a>c)?a:c):((b>c)?b:c);

    printf("largest =%d",largest);
    return 0;
}