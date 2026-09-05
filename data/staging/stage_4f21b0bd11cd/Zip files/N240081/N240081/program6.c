//write a menu based program for add ,sub and some 
#include <stdio.h>
#include <math.h>

int main()
{
    int a, b, choice;

    printf("Enter two integers: ");
    scanf("%d %d", &a, &b);

    printf("\n----- MENU -----\n");
    printf("1. Addition\n");
    printf("2. Subtraction\n");
    printf("3. Multiplication\n");
    printf("4. Division\n");
    printf("5. Modulus\n");
    printf("6. Power\n");
    printf("Enter your choice: ");
    scanf("%d", &choice);

    switch(choice)
    {
        case 1:
            printf("Addition = %d\n", a + b);
            break;

        case 2:
            printf("Subtraction = %d\n", a - b);
            break;

        case 3:
            printf("Multiplication = %d\n", a * b);
            break;

        case 4:
            if(b != 0)
                printf("Division = %.2f\n", (float)a / b);
            else
                printf("Division by zero is not possible.\n");
            break;

        case 5:
            if(b != 0)
                printf("Modulus = %d\n", a % b);
            else
                printf("Modulus by zero is not possible.\n");
            break;

        case 6:
            printf("Power = %.2f\n", pow(a, b));
            break;

        default:
            printf("Invalid choice!\n");
    }

    return 0;
}