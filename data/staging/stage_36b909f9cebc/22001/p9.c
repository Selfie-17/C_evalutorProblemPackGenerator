#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) == 1) {
        long long sum = 0, val;
        for (int i = 0; i < n; i++) {
            if (scanf("%lld", &val) == 1) sum += val;
        }
        printf("%lld", sum);
    }
    return 0;
}
