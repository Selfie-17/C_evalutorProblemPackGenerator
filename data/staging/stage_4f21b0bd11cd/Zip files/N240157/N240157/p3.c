//write a program to check whether a given character is an uppercase letter,lower case letter, digit, or special character
#include<stdio.h>
int main(){
     char ch;
     
     printf("enter the character=");
     scanf("%c",&ch);
    if(ch>='A'&&ch<='Z')
      printf(" uppercase");
    else if(ch>='a'&&ch<='z')
      printf("\n is lowercase");
    else if(ch>='0'&&ch<='9') 
       printf("digit");
    else
       printf("special character"); 
    return 0;
}       