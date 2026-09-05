#include<stdio.h>
//program to check whether it us a uppercase,lowercasr,digit,or special character.
int main(){
    char ch;
    printf("enter a character:");
    scanf("%c",&ch);
    if(ch>='A'&&ch<='Z'){
        printf("%c is a upper case letter",ch);
    }
    else if(ch>='a'&&ch<='z'){
        printf("%c is alower case letter",ch);
    }
    else if(ch>='0'&&ch<='9'){
        printf("%C is a digit",ch);
    }
    else{
        printf("%c is a special character",ch);
    }
    return 0;

}