//grade points using marks using nested loops
#include<stdio.h>
int main()
{
    int marks;
    printf("enter marks");
    scanf("%d",&marks);

    if(marks>=90){
        printf("a grade");
    }
    else if (marks>=80)
        printf("b grade");
    else if (marks>=70)
        printf("c grade");
    else if (marks>=60)
        printf("d grade");
    else
        printf("f grade");

      
}