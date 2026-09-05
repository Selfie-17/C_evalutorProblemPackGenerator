#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) == 1) {
        long long fact = 1;
        for (int i = 1; i <= n; i++) fact *= i;
        printf("%lld", fact);
    }
    return 0;
}
