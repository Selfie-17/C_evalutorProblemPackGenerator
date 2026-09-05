#include<stdio.h>
int main(){
    int num,i,p=0;
    printf("Enter the number:");
    scanf("%d",&num);
    for(i=1;i*i<=num;i++){
        if(num==i*i){
            p=p+1;
            break;
        }
    }
    if(p==1){
        printf("It is a perfect square");
    }
    else{
        printf("It is not a perfect square");
    }
    return 0;
}
