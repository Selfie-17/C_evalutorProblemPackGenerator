#include<stdio.h>
int main(){
    int m;
    printf("enter the marks=");
    scanf("%d",&m);
    if(m>=0&&m<=100)
    {
        if(m<=90 && m>=100)
         printf("grade is A");
        else if(m<=80&&m>90)
          printf("grade is B");
        else if(m>=70&&m<80)
          printf("grade is C");
        else if(m>=60&&m<=70)
          printf("grade is D");
        else if(m>=35)
          printf("pass");
        else
           printf("F") ;
    }       
    return 0;
}