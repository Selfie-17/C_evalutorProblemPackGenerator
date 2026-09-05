/level 3//

// menu calculator with invalid choice and divide by zero

#include<stdio.h>
int main()
{
    int ch,a ,b;
    printf("1.add\n 2.sub\n 3.mul\n 4.div\n");
    scanf("%d",&ch);

    printf("enter two nnumbers");
    scanf("%d %d",&a,&b);

    switch(ch)
    {
        case 1:
        printf("%d",a+b);
    break;
        case 2:
        printf("%d",a-b);
    break;
        case 3:
        printf("%d",a*b);
    break;
        case 4:
            if (b==0)
            printf("division by zero not possible");
            else
                printf("%d",a/b);
            break;
        default:
        printf("invalid choice");
    }
    return 0;
}