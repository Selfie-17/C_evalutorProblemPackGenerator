// classifying a character as up or lp character or digit or special character
#include<stdio.h>
int main()
{
    char cr;
    printf("Enter any character :");
    scanf("%c",&cr);// %c specifies c to read a single character
    if(cr>='A'  &&  cr<='Z') // ranges from  ASCI values from A to Z
        {
           printf("The given character is a uppercase character");
        }
    else if(cr>='a'  &&   cr<='z') // ranges from  ASCI values from a to z
         {
            printf("The given character is a lowercase character");
         }
    else if(cr>='0' &&  cr<='9') // ranges from  ASCI values from a to z
         {
            printf("The given character is a digit");
         }
    else 
        {
            printf("The given character is a special charater");
         }

    return 0;
}