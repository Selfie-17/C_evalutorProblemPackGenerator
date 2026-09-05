// to check perfect square or not//

#include<stdio.h>
int main()
{
    int n,i;
    printf("enter a number;");
    scanf("%d",&n);

    for(i=1;i*i <=n;i++)
    {
        if(i*i==n)
        {
            printf("perfect square");
            return 0;
        }
       
    }
     printf("not perfect squarre");
}