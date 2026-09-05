// write a program to find the given number is whether a positive or negitive or zero
#include<stdio.h>
int main(){
   int n;
   printf("enter the number=");
   scanf("%d",&n);
    if (n>0)
       printf("\n%d is  positive",n);
    else if(n<0)
       printf("\n%d is negetive",n);
    else 
       printf("\n%d is zero",n); 
   return 0;
}       