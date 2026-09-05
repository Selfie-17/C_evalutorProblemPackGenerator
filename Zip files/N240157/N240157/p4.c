//write whether the given year is leap or not
#include<stdio.h>
int main(){
    int y;
    printf("enter the year=");
    scanf("%d",&y);
    if(y%4==0)
    {
      if(y%100==0)
      {
         
         if(y%400==0)
         
            printf("leap year"); 
         else
            printf("not a leap year");
      }
      else
      {
         printf("leap year");
      }
    }
    else 
    {
      printf(" not aleap year"); 
    }      
    return 0;
   }   