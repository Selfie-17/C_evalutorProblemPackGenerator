#include <stdio.h>
//program to convert grade point to letter.

int main()
{
    float gp;

    printf("Enter Grade Point (0.0 - 4.0): ");
    scanf("%f", &gp);

    switch ((int)gp)
    {
        case 4:
            printf("Letter Grade: A");
            break;

        case 3:
            printf("Letter Grade: B");
            break;

        case 2:
            printf("Letter Grade: C");
            break;

        case 1:
            printf("Letter Grade: D");
            break;

        case 0:
            printf("Letter Grade: F");
            break;

        default:
            printf("Invalid Grade Point");
    }

    return 0;
}