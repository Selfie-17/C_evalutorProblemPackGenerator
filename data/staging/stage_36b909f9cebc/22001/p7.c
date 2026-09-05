#include <stdio.h>

int main() {
    long long n;
    if (scanf("%lld", &n) == 1) {
        if (n < 2) { printf("COMPOSITE"); return 0; }
        int is_prime = 1;
        for (long long i = 2; i * i <= n; i++) {
            if (n % i == 0) { is_prime = 0; break; }
        }
        printf("%s", is_prime ? "PRIME" : "COMPOSITE");
    }
    return 0;
}
