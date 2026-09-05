#include<stdio.h>
//menu-based calculator using switch
#include<math.h>
 int main(){
    int a,b,ch;
    printf("enter two numbers:");
    scanf("%d%d",&a,&b);
     printf("1.Add\n2.Subtract\n3.MUltiply\n4.Divide\n5.Modulus\n6.power\n");
     printf("enteryour choice:");
     scanf("%d",&ch);

     switch(ch){
        case 1:
        printf("sum=%d",a+b);
        break;
        case 2:
        printf("difference=%d",a-b);
        break;
        case 3:
        printf("prorduct=%d",a*b);
        break;
        case 4:
        printf("division=%d",a/b);
        break;
        case 5:
        printf("modulus=%d",a%b);
        break;
        case 6:
        printf("power=%f",pow(a,b));
        break;
        default:
        printf("invalid choice");

     }
     return 0;
 }