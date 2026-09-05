
/*write a menu based program to read two values and choice, and perform addition, subtration, multiplication,
 division, modulus or power using a switch statement*/
   #include<stdio.h>
   int main(){

   int a,b,choice;
   printf("enter a and b=");
   scanf("%d %d",&a,&b);
   printf("\n1.Addition");
   printf("\n2.Subtraction");
    printf("\n3.multiplication");
    printf("\n4.division");
    printf("\n5.modulus");
    printf("enter the choice=");
    scanf("%d",&choice);
    switch(choice)
    {
        case 1:
           printf("result=%d",a+b);
           break;
        case 2:
           printf("result=%d",a-b);
           break;
        case 3:
           printf("result=%d",a*b) ;
           break;
        case 4:
           printf("result=%d",a/b);
           break;
        case 5:
           printf("result=%d",a%b); 
           break;
        default:
           printf("invalid choice");

    }
    return 0;
}