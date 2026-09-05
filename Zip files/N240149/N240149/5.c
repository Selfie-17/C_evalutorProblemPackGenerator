
//5.To print memory allocation
#include<stdio.h>
int main(){
int a=6;
char b;
float c;
unsigned int d;
signed  int e;
printf("The size of int=%d\n",sizeof(a));
printf("The size of char=%zu\n",sizeof(b));
printf("The size of float=%zu\n",sizeof(c));
printf("The size of unsigned int=%zu\n",sizeof(d));
printf("The size of signed int=%d\n",sizeof(e));
return 0;
}