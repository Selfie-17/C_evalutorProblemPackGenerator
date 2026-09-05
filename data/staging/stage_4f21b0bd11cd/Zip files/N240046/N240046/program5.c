#include<stdio.h>
//program to print memory allocation required for all data types
int main(){
    printf("char occupies %zu bytes\n",sizeof(char));
    printf("float occupies %zu bytes\n",sizeof(float));
    printf("int occupies %zu bytes\n",sizeof(int));
    printf("double occupies %zu bytes\n",sizeof(double));
    printf("long double occupies %zu bytes\n",sizeof(long double));
        printf("long int occupies %zu bytes\n",sizeof(long int));
    printf("short int occupies %zu bytes\n",sizeof(short int));



    return 0;
    

}