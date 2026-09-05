#include<stdio.h>
int main(){
    int i,n;
    printf("enter n=");
    scanf("%d",&n);
    for (i=1;i<=n;i++)
    {
       if(i*i==n)
       {
         printf("%d is a perfect square",n);
         return 0;
       } 
    }
    
    printf("not a perfect square");   
     
    return 0;
}