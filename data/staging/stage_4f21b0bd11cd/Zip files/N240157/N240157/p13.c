//write a program that converts a numeric grade point (0.0 to 4.0) into a letter grade with +/-
//modifiers using a switch statement on the integer part combined with relational checks on the decimal part.
#include<stdio.h>
int main(){
    float gp;
    int grade;
    printf("Enter grade point (0.0 to 4.0)=");
    scanf("%f",&gp);
    grade=(int)gp;
    switch(grade){
        case 4:
          printf("grade=A");
          break;
        case 3:
           if(gp>=3.7)
             printf("grade=A-");
           else if(gp>=3.3)
              printf("Grade=B+");
           else 
              printf("Grade=B");
           break;
        case 2:
           if(gp>=2.7)
             printf("Grade=B-");
           else if(gp>=2.3)
             printf("Grade=C+"); 
           else
             printf("Grade=C");
           break;

        case 1:
           if(gp>=1.7)
             printf("Grade=C-");
           else if(gp>=1.3)
             printf("Grade=D+");
           else 
             printf("Grade=D");
           break; 

        case 0:
           if(gp==0)
             printf("Grade=F");
           else
             printf("Grade=D-");
           break ;
        default:
          printf("invalid Grade Point");

    }
    return 0;
}