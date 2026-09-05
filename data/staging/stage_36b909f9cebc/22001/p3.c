#include <stdio.h>

int main() {
    long long a, b, c;
    if (scanf("%lld %lld %lld", &a, &b, &c) == 3) {
        long long max_val = a;
        if (b > max_val) max_val = b;
        if (c > max_val) max_val = c;
        printf("%lld", max_val);
    }
    return 0;
}
