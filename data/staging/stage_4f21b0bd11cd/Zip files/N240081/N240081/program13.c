//grade points in between 0.1 to 0.4
#include<stdio.h>
int main()
{
    float gp;
    int grade;
    printf("enter grade point");
    scanf("%f",&gp);


    grade=(int)gp;

    switch(grade)
    {
        case 4:
        printf("a");
        break;
        case 3:
        printf("b");
        break;
        case 2:
        printf("c");
        break;
        case 1:
        printf("d");
        break;
        default:
        printf("f");


    }
}