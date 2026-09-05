#include<stdio.h>
int main(){
    float gpa,dec;
    int k;
    printf("Enter gpa(0.0 to 0.4):");
    scanf("%f",&gpa);
    k=(int)gpa;
    dec=gpa-k;
    switch (k)
    {
      case 4:
      if(dec>0.0 && dec<0.5)
     { 
        printf("A-");
    }
     else
     printf("A+");
     break;
     case 3:
    if(dec>0.0 && dec<0.5)
    {
        printf("B-");
    }
    else
    printf("B+");
    break;
    case 2:
    if(dec>0.0 && dec<0.5)
    printf("C-");
    else
    printf("C+");
    break;
    case 1:
    printf("Fail");
    break;

    default:
        printf("Invalid");
    }
    return 0;
}