#include <stdio.h>

int main() {
    long long x;
    if (scanf("%lld", &x) == 1) {
        if (x < 0) { printf("0"); return 0; }
        long long orig = x, rev = 0;
        while (x > 0) {
            rev = rev * 10 + (x % 10);
            x /= 10;
        }
        printf("%d", (orig == rev) ? 1 : 0);
    }
    return 0;
}
