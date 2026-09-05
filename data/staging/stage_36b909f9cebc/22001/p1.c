#include <stdio.h>

int main() {
    long long a, b;
    if (scanf("%lld %lld", &a, &b) == 2) {
        printf("%lld", a + b);
    }
    return 0;
}
