//3.To check whether the character is upper,lower case ,digit,spcl char
#include<stdio.h>
int main(){
    char ch;
    printf("Enter a character:");
    scanf("%c",&ch);
    if(ch>='A'&&ch<='Z'){
        printf("It is upper case");
    }
    else if(ch>='a'&&ch<='z'){
        printf("It is lower case");
    }
    else if(ch>='0'&&ch<='9'){
        printf("It is a digit");
    }
    else{
        printf("It is a special character");

    }
    return 0;
    
}