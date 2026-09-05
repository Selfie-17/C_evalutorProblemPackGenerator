
//write a program to print the mwmory allocation required for all data types in C
#include<stdio.h>
int main(){
    printf("char occupies %d bytes\n",sizeof(char))  ;
    printf("short int occupies %d bytes",sizeof(short int));
    printf("long int occupies %d bytes",sizeof(short int));
    printf("long double occupies %d bytes",sizeof(long double));
    printf("int occupies %d bytes\n ",sizeof(int));
    printf("float occupies %d bytes",sizeof(float));
    printf("double occupies %d bytes",sizeof(double));  
          
    return 0; 
}     