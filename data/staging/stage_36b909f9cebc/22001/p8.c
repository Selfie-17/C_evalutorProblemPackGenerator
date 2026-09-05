#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) == 1) {
        if (n == 0) { printf("0"); return 0; }
        if (n == 1) { printf("1"); return 0; }
        long long a = 0, b = 1, c = 0;
        for (int i = 2; i <= n; i++) {
            c = a + b;
            a = b;
            b = c;
        }
        printf("%lld", b);
    }
    return 0;
}
