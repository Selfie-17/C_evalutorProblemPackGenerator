#include <stdio.h>

int main() {
    long long n;
    if (scanf("%lld", &n) == 1) {
        if (n % 2 == 0) printf("EVEN");
        else printf("ODD");
    }
    return 0;
}
